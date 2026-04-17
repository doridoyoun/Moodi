import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Flame,
  Heart,
  Leaf,
  Smile,
} from 'lucide-react-native';
import EntryDetailModalCard from '../components/timeline/EntryDetailModalCard';
import HourEntryActions from '../components/timeline/HourEntryActions';
import HourInspectOverlay from '../components/timeline/HourInspectOverlay';
import NotebookLayout from '../components/NotebookLayout';
import { useMood } from '../src/context/MoodContext';
import { moodOrder, moodPalette, notebook } from '../constants/theme';
import { formatDateKeyForDisplay, getEntriesForDate, toDateKey } from '../storage/timelineStateStorage';
import {
  markFirstEmotionRecorded,
  shouldShowFirstEmotionGuidance,
} from '../storage/firstEmotionGuidanceStorage';
import { countTitledMemos, joinMemo, paletteFor, splitMemo } from '../utils/timelineEntryFormat';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getOneLineDailySummary(dayEntries) {
  if (!Array.isArray(dayEntries) || dayEntries.length === 0) return '아직 기록이 없어요';

  const sorted = [...dayEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {number[]} */
  const hourCounts = Array.from({ length: 24 }, () => 0);
  for (const e of sorted) {
    const id = e?.emotionId;
    if (typeof id !== 'string') continue;
    counts[id] = (counts[id] ?? 0) + 1;
    const h = typeof e?.hour === 'number' ? e.hour : null;
    if (h != null && h >= 0 && h <= 23) hourCounts[h] += 1;
  }

  const total = sorted.length;
  const uniqueEmotions = Object.keys(counts).length;

  const byBucket = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const e of sorted) {
    const h = typeof e?.hour === 'number' ? e.hour : null;
    if (h == null) continue;
    if (h >= 6 && h <= 11) byBucket.morning += 1;
    else if (h >= 12 && h <= 17) byBucket.afternoon += 1;
    else if (h >= 18 && h <= 23) byBucket.evening += 1;
    else byBucket.night += 1;
  }

  let switches = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]?.emotionId;
    const cur = sorted[i]?.emotionId;
    if (prev && cur && prev !== cur) switches += 1;
  }

  const after16 = sorted.filter((e) => (typeof e?.hour === 'number' ? e.hour : -1) >= 16);
  let switchesAfter16 = 0;
  for (let i = 1; i < after16.length; i += 1) {
    const prev = after16[i - 1]?.emotionId;
    const cur = after16[i]?.emotionId;
    if (prev && cur && prev !== cur) switchesAfter16 += 1;
  }

  // 1) time concentration (strongest)
  // Prefer a narrow 3-hour window (e.g. 16시~18시), otherwise fall back to afternoon/evening.
  if (total >= 3) {
    let bestStart = null;
    let bestCount = 0;
    for (let start = 0; start <= 21; start += 1) {
      const c = hourCounts[start] + hourCounts[start + 1] + hourCounts[start + 2];
      if (c > bestCount) {
        bestCount = c;
        bestStart = start;
      }
    }
    const strongWindow = bestStart !== null && bestCount >= Math.max(2, Math.ceil(total * 0.6));
    if (strongWindow) {
      return `${bestStart}시~${bestStart + 2}시에 기록이 몰려 있어요`;
    }
  }

  const bucketThreshold = Math.max(2, Math.ceil(total * 0.5));
  if (byBucket.afternoon >= bucketThreshold) return '오후에 기록이 많아요';
  if (byBucket.evening >= bucketThreshold) return '저녁에 기록이 많아요';

  // 2) record count (default when there is no strong concentration)
  // 3) mixed emotions (prefer when multiple emotion types exist)
  if (uniqueEmotions >= 3) return '지금까지 여러 감정이 함께 남아 있어요';
  if (uniqueEmotions === 2) {
    const topTwo = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => id);
    const a = topTwo[0];
    const b = topTwo[1];
    const aLabel = a && moodPalette[a] ? moodPalette[a].label : null;
    const bLabel = b && moodPalette[b] ? moodPalette[b].label : null;
    if (aLabel && bLabel) return `지금까지 ${aLabel}과 ${bLabel}가 함께 남아 있어요`;
    return '지금까지 여러 감정이 함께 남아 있어요';
  }

  // 4) multiple changes (only when strong)
  if (switches >= 3 && switchesAfter16 >= 2) return '16시 이후 감정이 자주 바뀌었어요';

  return `오늘 기록이 ${total}개 있어요`;
}

/**
 * Rolling window: at most this many moods per hour cell, always the most recent by time.
 * Left = oldest visible, right = newest visible; older entries drop off the left when > 4.
 */
const ROLLING_MOOD_WINDOW = 4;

/**
 * Smooth horizontal flow: one mood per stop, blended transitions (older → newer, left → right).
 */
function rollingWindowGradientStops(bgColors) {
  const n = bgColors.length;

  if (n === 1) {
    return {
      colors: [bgColors[0], bgColors[0]],
      locations: [0, 1],
    };
  }

  if (n === 2) {
    return {
      colors: [bgColors[0], bgColors[1]],
      locations: [0, 1],
    };
  }

  if (n === 3) {
    return {
      colors: [bgColors[0], bgColors[1], bgColors[2]],
      locations: [0, 0.5, 1],
    };
  }

  return {
    colors: [bgColors[0], bgColors[1], bgColors[2], bgColors[3]],
    locations: [0, 0.33, 0.66, 1],
  };
}

const moodIcons = {
  happy: Smile,
  flutter: Heart,
  calm: Leaf,
  gloom: CloudRain,
  annoyed: Flame,
};

export default function TimelineScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    entries,
    selectedDate,
    shiftSelectedDateByDays,
    getEntriesForHour,
    createEntry,
    updateEntry,
    deleteEntry,
    registerEmotionToastAfterLog,
    setRepresentativeOverrideForDate,
  } = useMood();

  const [activeHour, setActiveHour] = useState(null);
  const [overlayMode, setOverlayMode] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [detailEntryId, setDetailEntryId] = useState(null);
  const [isDetailEditing, setIsDetailEditing] = useState(false);
  const [detailEditEmotion, setDetailEditEmotion] = useState('happy');
  const [detailEditTitle, setDetailEditTitle] = useState('');
  const [detailEditContent, setDetailEditContent] = useState('');
  const [detailEditImageUri, setDetailEditImageUri] = useState(null);
  const [memoPromptEntryId, setMemoPromptEntryId] = useState(null);
  /** UI-only: hour row targeted for next quick emotion (not persisted). */
  const [selectedTimelineHour, setSelectedTimelineHour] = useState(null);

  const overlayFade = useRef(new Animated.Value(0)).current;
  const overlaySlide = useRef(new Animated.Value(10)).current;
  const dailySummaryOpacity = useRef(new Animated.Value(0)).current;
  const memoPromptTimerRef = useRef(null);
  const emotionToastTimerRef = useRef(null);
  const [emotionToastText, setEmotionToastText] = useState(null);

  const [firstGuideActive, setFirstGuideActive] = useState(false);
  const firstGuideActiveRef = useRef(false);
  const [firstFollowUpVisible, setFirstFollowUpVisible] = useState(false);
  const firstFollowUpEntryIdRef = useRef(null);
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);

  const flashEmotionToast = useCallback((message) => {
    if (emotionToastTimerRef.current) {
      clearTimeout(emotionToastTimerRef.current);
      emotionToastTimerRef.current = null;
    }
    setEmotionToastText(message);
    emotionToastTimerRef.current = setTimeout(() => {
      setEmotionToastText(null);
      emotionToastTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    firstGuideActiveRef.current = firstGuideActive;
  }, [firstGuideActive]);

  useEffect(() => {
    let cancelled = false;
    shouldShowFirstEmotionGuidance(entries.length).then((show) => {
      if (!cancelled) setFirstGuideActive(show);
    });
    return () => {
      cancelled = true;
    };
  }, [entries.length]);

  const todayKey = toDateKey(new Date());
  const isToday = selectedDate === todayKey;
  const isFutureDateView = selectedDate > todayKey;
  const currentRealHour = new Date().getHours();

  const canSelectHour = useCallback(
    (hour) => {
      if (isFutureDateView) return false;
      if (selectedDate < todayKey) return true;
      if (selectedDate === todayKey) return hour <= currentRealHour;
      return false;
    },
    [currentRealHour, isFutureDateView, selectedDate, todayKey],
  );

  const onPressHourSlot = useCallback(
    (hour) => {
      if (!canSelectHour(hour)) return;
      setSelectedTimelineHour((prev) => (prev === hour ? null : hour));
    },
    [canSelectHour],
  );

  const clearTimelineHourSelection = useCallback(() => {
    setSelectedTimelineHour(null);
  }, []);

  useEffect(() => {
    setSelectedTimelineHour(null);
  }, [selectedDate]);

  useEffect(() => {
    if (!firstGuideActive || !isToday || isFutureDateView) {
      pulseScale.setValue(1);
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
        pulseLoopRef.current = null;
      }
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    pulseLoopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      pulseLoopRef.current = null;
      pulseScale.setValue(1);
    };
  }, [firstGuideActive, isToday, isFutureDateView, pulseScale]);

  useEffect(() => {
    dailySummaryOpacity.setValue(0);
    Animated.timing(dailySummaryOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [dailySummaryOpacity]);

  const detailEntry = useMemo(
    () => (detailEntryId ? entries.find((e) => e.id === detailEntryId) ?? null : null),
    [entries, detailEntryId],
  );

  useEffect(() => {
    if (detailEntryId && !detailEntry) {
      setDetailEntryId(null);
    }
  }, [detailEntryId, detailEntry]);

  const beginDetailEdit = useCallback(() => {
    const e = detailEntry;
    if (!e) return;
    const { title, content } = splitMemo(e.memo);
    setDetailEditEmotion(e.emotionId);
    setDetailEditTitle(title);
    setDetailEditContent(content);
    setDetailEditImageUri(e.imageUri && String(e.imageUri).trim() ? e.imageUri.trim() : null);
    setIsDetailEditing(true);
  }, [detailEntry]);

  const cancelDetailEdit = useCallback(() => {
    setIsDetailEditing(false);
    Keyboard.dismiss();
    if (detailEntry) {
      setDetailEditImageUri(
        detailEntry.imageUri && String(detailEntry.imageUri).trim()
          ? String(detailEntry.imageUri).trim()
          : null,
      );
    }
  }, [detailEntry]);

  const saveDetailEdit = useCallback(() => {
    const e = detailEntry;
    if (!e) return;
    const memo = joinMemo(detailEditTitle, detailEditContent);
    const uri =
      typeof detailEditImageUri === 'string' && detailEditImageUri.trim().length > 0
        ? detailEditImageUri.trim()
        : '';
    updateEntry(e.id, { emotionId: detailEditEmotion, memo, imageUri: uri });
    setIsDetailEditing(false);
    Keyboard.dismiss();
  }, [
    detailEditContent,
    detailEditEmotion,
    detailEditImageUri,
    detailEditTitle,
    detailEntry,
    updateEntry,
  ]);

  const closeDetailModal = useCallback(() => {
    if (memoPromptTimerRef.current) {
      clearTimeout(memoPromptTimerRef.current);
      memoPromptTimerRef.current = null;
    }
    setMemoPromptEntryId(null);
    setDetailEntryId(null);
    setIsDetailEditing(false);
    setDetailEditImageUri(null);
    Keyboard.dismiss();
  }, []);

  const onDetailModalRequestClose = useCallback(() => {
    if (isDetailEditing) {
      cancelDetailEdit();
    } else {
      closeDetailModal();
    }
  }, [cancelDetailEdit, closeDetailModal, isDetailEditing]);

  const onToggleRepresentativeOverride = useCallback(
    (next) => {
      if (!detailEntry) return;
      setRepresentativeOverrideForDate(detailEntry.id, selectedDate, next);
    },
    [detailEntry, selectedDate, setRepresentativeOverrideForDate],
  );

  const confirmDeleteEntry = useCallback(
    (id) => {
      Alert.alert('이 기록을 삭제할까요?', '', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            deleteEntry(id);
            closeDetailModal();
          },
        },
      ]);
    },
    [closeDetailModal, deleteEntry],
  );

  const closeEntryOverlay = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(overlaySlide, {
        toValue: 10,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setOverlayVisible(false);
        setActiveHour(null);
        setOverlayMode(null);
      }
    });
  }, [overlayFade, overlaySlide]);

  const openEntryOverlayForHour = useCallback(
    (hour, mode) => {
      if (overlayVisible && activeHour === hour && overlayMode === mode) {
        closeEntryOverlay();
        return;
      }
      if (overlayVisible && activeHour === hour && overlayMode !== mode) {
        setOverlayMode(mode);
        return;
      }
      setActiveHour(hour);
      setOverlayMode(mode);
      setOverlayVisible(true);
    },
    [activeHour, closeEntryOverlay, overlayMode, overlayVisible],
  );

  useEffect(() => {
    if (!overlayVisible || activeHour === null || overlayMode === null) return;
    overlayFade.setValue(0);
    overlaySlide.setValue(10);
    Animated.parallel([
      Animated.timing(overlayFade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlaySlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayVisible, overlayFade, overlaySlide]);

  const overlaySortedEntries = useMemo(() => {
    if (!overlayVisible || activeHour === null) return [];
    const list = getEntriesForHour(activeHour);
    return [...list].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [overlayVisible, activeHour, getEntriesForHour, entries]);

  const overlayMemoEntriesDesc = useMemo(() => {
    if (!overlayVisible || activeHour === null) return [];
    const list = getEntriesForHour(activeHour);
    return list
      .filter((e) => (splitMemo(e.memo).title || '').trim().length > 0)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [overlayVisible, activeHour, getEntriesForHour, entries]);

  const openDetailFromOverlay = useCallback(
    (entryId) => {
      setIsDetailEditing(false);
      setDetailEntryId(entryId);
      closeEntryOverlay();
    },
    [closeEntryOverlay],
  );

  const onMemoPromptAdd = useCallback(() => {
    if (!memoPromptEntryId) return;
    if (memoPromptTimerRef.current) {
      clearTimeout(memoPromptTimerRef.current);
      memoPromptTimerRef.current = null;
    }
    const id = memoPromptEntryId;
    setMemoPromptEntryId(null);
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    const { title, content } = splitMemo(e.memo);
    setDetailEntryId(id);
    setDetailEditEmotion(e.emotionId);
    setDetailEditTitle(title);
    setDetailEditContent(content);
    setDetailEditImageUri(e.imageUri && String(e.imageUri).trim() ? e.imageUri.trim() : null);
    setIsDetailEditing(true);
  }, [entries, memoPromptEntryId]);

  const onQuickEmotion = useCallback(
    (emotionId) => {
      if (isFutureDateView) return;

      const handleFirstGuideSuccess = (entry) => {
        void markFirstEmotionRecorded();
        setFirstGuideActive(false);
        firstGuideActiveRef.current = false;
        flashEmotionToast('감정이 기록됐어요');
        firstFollowUpEntryIdRef.current = entry.id;
        setFirstFollowUpVisible(true);
      };

      if (selectedTimelineHour !== null) {
        const hour = selectedTimelineHour;
        if (!canSelectHour(hour)) {
          setSelectedTimelineHour(null);
          return;
        }
        const entry = createEntry({
          emotionId,
          memo: '',
          dateKey: selectedDate,
          hour,
        });
        if (entry?.id) {
          if (firstGuideActiveRef.current) {
            handleFirstGuideSuccess(entry);
            return;
          }
          const dk = selectedDate;
          const dayList = [...getEntriesForDate(entries, dk), entry].sort(
            (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
          );
          const toastMsg = registerEmotionToastAfterLog(dk, dayList);
          if (toastMsg) flashEmotionToast(toastMsg);
          if (memoPromptTimerRef.current) {
            clearTimeout(memoPromptTimerRef.current);
          }
          setMemoPromptEntryId(entry.id);
          memoPromptTimerRef.current = setTimeout(() => {
            memoPromptTimerRef.current = null;
            setMemoPromptEntryId((cur) => (cur === entry.id ? null : cur));
          }, 3000);
        }
        return;
      }

      if (isToday) {
        const hour = new Date().getHours();
        const entry = createEntry({
          emotionId,
          memo: '',
          dateKey: todayKey,
          hour,
        });
        if (entry?.id) {
          if (firstGuideActiveRef.current) {
            handleFirstGuideSuccess(entry);
            return;
          }
          const dk = todayKey;
          const dayList = [...getEntriesForDate(entries, dk), entry].sort(
            (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
          );
          const toastMsg = registerEmotionToastAfterLog(dk, dayList);
          if (toastMsg) flashEmotionToast(toastMsg);
          if (memoPromptTimerRef.current) {
            clearTimeout(memoPromptTimerRef.current);
          }
          setMemoPromptEntryId(entry.id);
          memoPromptTimerRef.current = setTimeout(() => {
            memoPromptTimerRef.current = null;
            setMemoPromptEntryId((cur) => (cur === entry.id ? null : cur));
          }, 3000);
        }
        return;
      }

      Alert.alert('', '기록할 시간대를 먼저 선택해주세요');
    },
    [
      canSelectHour,
      createEntry,
      entries,
      flashEmotionToast,
      isFutureDateView,
      isToday,
      registerEmotionToastAfterLog,
      selectedDate,
      selectedTimelineHour,
      todayKey,
    ],
  );

  useEffect(
    () => () => {
      if (memoPromptTimerRef.current) {
        clearTimeout(memoPromptTimerRef.current);
      }
      if (emotionToastTimerRef.current) {
        clearTimeout(emotionToastTimerRef.current);
      }
    },
    [],
  );

  const dateLabel = useMemo(
    () => formatDateKeyForDisplay(selectedDate, 'ko-KR'),
    [selectedDate],
  );

  const dayEntries = useMemo(() => getEntriesForDate(entries, selectedDate), [entries, selectedDate]);
  const dailySummaryText = useMemo(() => getOneLineDailySummary(dayEntries), [dayEntries]);

  const scrollRef = useRef(null);
  const hourYRef = useRef({});
  const hourRowHeightRef = useRef(54);
  const scrollViewportHRef = useRef(0);

  const scrollToCurrentHour = useCallback(() => {
    if (!isToday) return;
    if (selectedTimelineHour !== null) return;
    const h = new Date().getHours();
    const y = hourYRef.current[h];
    const rowH = hourRowHeightRef.current;
    const vh = scrollViewportHRef.current;
    if (scrollRef.current == null || y == null || vh <= 0) return;
    const targetY = y - vh / 2 + rowH / 2;
    scrollRef.current.scrollTo({ y: Math.max(0, targetY), animated: false });
  }, [isToday, selectedTimelineHour]);

  useFocusEffect(
    useCallback(() => {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(scrollToCurrentHour);
      });
      return () => cancelAnimationFrame(id);
    }, [scrollToCurrentHour, selectedDate]),
  );

  useEffect(() => {
    if (!isToday) return;
    const t1 = setTimeout(scrollToCurrentHour, 160);
    const t2 = setTimeout(scrollToCurrentHour, 320);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isToday, selectedDate, scrollToCurrentHour]);

  const emotionBarBottomPad = Math.max(insets.bottom, 12);

  return (
    <NotebookLayout
      footer={
        <View style={[styles.footerWrap, { paddingBottom: emotionBarBottomPad }]}>
          {memoPromptEntryId ? (
            <View style={styles.memoPromptCard}>
              <Text style={styles.memoPromptLine}>감정이 기록됐어요</Text>
              <Text style={styles.memoPromptSub}>메모를 추가할까요?</Text>
              <Pressable
                onPress={onMemoPromptAdd}
                style={({ pressed }) => [
                  styles.memoPromptBtn,
                  pressed && { opacity: 0.88 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="메모 추가"
              >
                <Text style={styles.memoPromptBtnText}>메모 추가</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.footerHints}>
            <Text style={styles.footerHintText}>
              {isToday
                ? '아래 감정을 눌러 오늘의 기분을 남겨요'
                : '시간대를 선택한 뒤 감정을 눌러 그날의 기분을 남겨요'}
            </Text>
          </View>
          {firstGuideActive && isToday && !isFutureDateView ? (
            <Text style={styles.firstGuideHint}>오늘의 감정을 가볍게 남겨보세요</Text>
          ) : null}
          {emotionToastText ? (
            <View style={styles.emotionToastBanner} accessibilityLiveRegion="polite">
              <Text style={styles.emotionToastText}>{emotionToastText}</Text>
            </View>
          ) : null}
          {firstFollowUpVisible ? (
            <View style={styles.firstFollowRow}>
              <Text style={styles.firstFollowQuestion}>이 순간을 조금 더 남겨볼까요?</Text>
              <View style={styles.firstFollowActions}>
                <Pressable
                  onPress={() => {
                    const id = firstFollowUpEntryIdRef.current;
                    setFirstFollowUpVisible(false);
                    if (!id) return;
                    if (memoPromptTimerRef.current) {
                      clearTimeout(memoPromptTimerRef.current);
                    }
                    setMemoPromptEntryId(id);
                    memoPromptTimerRef.current = setTimeout(() => {
                      memoPromptTimerRef.current = null;
                      setMemoPromptEntryId((cur) => (cur === id ? null : cur));
                    }, 3000);
                  }}
                  style={({ pressed }) => [styles.firstFollowBtn, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel="남기기"
                >
                  <Text style={styles.firstFollowBtnText}>남기기</Text>
                </Pressable>
                <Pressable
                  onPress={() => setFirstFollowUpVisible(false)}
                  style={({ pressed }) => [styles.firstFollowBtnSecondary, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel="나중에"
                >
                  <Text style={styles.firstFollowBtnSecondaryText}>나중에</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <Animated.View
            style={[
              styles.quickEmotionRow,
              isFutureDateView && styles.quickEmotionRowDisabled,
              firstGuideActive && isToday && !isFutureDateView ? { transform: [{ scale: pulseScale }] } : null,
            ]}
          >
            {moodOrder.map((key) => {
              const Icon = moodIcons[key];
              const m = moodPalette[key];
              return (
                <Pressable
                  key={key}
                  disabled={isFutureDateView}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  onPress={() => onQuickEmotion(key)}
                  style={({ pressed }) => [
                    styles.quickFab,
                    { backgroundColor: m.bg, borderColor: m.border },
                    pressed && !isFutureDateView && { opacity: 0.85 },
                  ]}
                >
                  <Icon size={22} color={m.ink} strokeWidth={2} />
                  <Text style={[styles.quickFabLabel, { color: m.ink }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      }
    >
      <View style={styles.timelineLayer}>
        <Pressable
          onPress={clearTimelineHourSelection}
          style={styles.titleBlockPressable}
          accessibilityRole="button"
          accessibilityLabel="시간 선택 해제"
        >
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>
              {isToday ? '⭐ 오늘의 감정 기록' : '⭐ 감정 기록'}
            </Text>

            <View style={styles.dateNav}>
              <Pressable
                hitSlop={10}
                onPress={() => shiftSelectedDateByDays(-1)}
                accessibilityRole="button"
                accessibilityLabel="어제"
              >
                <ChevronLeft size={22} color={notebook.inkMuted} />
              </Pressable>
              <View style={styles.dateNavCenter}>
                <Text style={styles.date}>{dateLabel}</Text>
                <Pressable
                  style={styles.calendarJump}
                  onPress={() => navigation.navigate('Calendar')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="캘린더로 이동"
                >
                  <Calendar size={18} color={notebook.inkMuted} strokeWidth={2} />
                </Pressable>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => shiftSelectedDateByDays(1)}
                accessibilityRole="button"
                accessibilityLabel="내일"
              >
                <ChevronRight size={22} color={notebook.inkMuted} />
              </Pressable>
            </View>

            <Animated.View style={[styles.dailySummaryWrap, { opacity: dailySummaryOpacity }]}>
              <Text style={styles.dailySummaryText} numberOfLines={2}>
                {dailySummaryText}
              </Text>
            </Animated.View>
          </View>
        </Pressable>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          onLayout={(e) => {
            scrollViewportHRef.current = e.nativeEvent.layout.height;
          }}
        >
          {HOURS.map((hour) => (
            <HourRowBlock
              key={hour}
              hour={hour}
              hourEntries={getEntriesForHour(hour)}
              overlayVisible={overlayVisible}
              activeHour={activeHour}
              overlayMode={overlayMode}
              onOpenEmotionInspect={() => openEntryOverlayForHour(hour, 'emotion')}
              onOpenMemoInspect={() => openEntryOverlayForHour(hour, 'memo')}
              onLayoutHour={(y, height) => {
                hourYRef.current[hour] = y;
                hourRowHeightRef.current = height;
              }}
              slotSelected={selectedTimelineHour === hour}
              slotSelectable={canSelectHour(hour)}
              onPressHourSlot={onPressHourSlot}
            />
          ))}

          <Pressable
            onPress={clearTimelineHourSelection}
            style={styles.timelineScrollBottomTap}
            accessibilityRole="button"
            accessibilityLabel="시간 선택 해제"
          />
        </ScrollView>

        <HourInspectOverlay
          overlayVisible={overlayVisible}
          activeHour={activeHour}
          overlayMode={overlayMode}
          emotionEntriesChronAsc={overlaySortedEntries}
          memoEntriesNewestFirst={overlayMemoEntriesDesc}
          overlayFade={overlayFade}
          overlaySlide={overlaySlide}
          onDismissBackdrop={closeEntryOverlay}
          onSelectEntry={openDetailFromOverlay}
        />
      </View>

      <EntryDetailModalCard
        visible={detailEntry != null}
        entry={detailEntry}
        isDetailEditing={isDetailEditing}
        detailEditEmotion={detailEditEmotion}
        setDetailEditEmotion={setDetailEditEmotion}
        detailEditTitle={detailEditTitle}
        setDetailEditTitle={setDetailEditTitle}
        detailEditContent={detailEditContent}
        setDetailEditContent={setDetailEditContent}
        bottomInset={insets.bottom}
        onClose={closeDetailModal}
        onRequestClose={onDetailModalRequestClose}
        onBeginEdit={beginDetailEdit}
        onCancelEdit={cancelDetailEdit}
        onSaveEdit={saveDetailEdit}
        onConfirmDelete={confirmDeleteEntry}
        isRepresentativeOverride={detailEntry?.isRepresentativeOverride === true}
        onToggleRepresentativeOverride={onToggleRepresentativeOverride}
        detailEditImageUri={detailEditImageUri}
        setDetailEditImageUri={setDetailEditImageUri}
      />
    </NotebookLayout>
  );
}

function HourRowBlock({
  hour,
  hourEntries,
  overlayVisible,
  activeHour,
  overlayMode,
  onOpenEmotionInspect,
  onOpenMemoInspect,
  onLayoutHour,
  slotSelected,
  slotSelectable,
  onPressHourSlot,
}) {
  const n = hourEntries.length;
  const memoCount = countTitledMemos(hourEntries);
  const inspectOpen = overlayVisible && activeHour === hour;

  return (
    <View
      style={styles.hourBlock}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onLayoutHour(y, height);
      }}
    >
      <View style={styles.hourRow}>
        <Pressable
          onPress={() => onPressHourSlot(hour)}
          disabled={!slotSelectable}
          style={({ pressed }) => [
            styles.hourRowPressableInner,
            pressed && slotSelectable && styles.hourRowPressablePressed,
          ]}
          accessibilityRole={slotSelectable ? 'button' : undefined}
          accessibilityLabel={`${String(hour).padStart(2, '0')}시 시간대 선택`}
        >
          <View style={styles.hourLabelWrap}>
            <Text style={styles.hourLabel}>
              {String(hour).padStart(2, '0')}:00
            </Text>
          </View>
          <View style={styles.chunkColFrame}>
            <View style={styles.chunkCol}>
              <View style={styles.chunkRow} accessibilityLabel={`${String(hour).padStart(2, '0')}시 감정 줄`}>
                <EntryStrip hourEntries={hourEntries} stripSelected={slotSelected} />
              </View>
            </View>
          </View>
        </Pressable>
      </View>
      {n > 0 ? (
        <View style={styles.hourEntryActionsWrap}>
          <HourEntryActions
            entryCount={n}
            memoCount={memoCount}
            inspectOpen={inspectOpen}
            inspectMode={inspectOpen ? overlayMode : null}
            onPressEmotion={onOpenEmotionInspect}
            onPressMemo={onOpenMemoInspect}
          />
        </View>
      ) : null}
    </View>
  );
}

function EntryStrip({ hourEntries, stripSelected }) {
  const { sorted, visibleEntries } = useMemo(() => {
    const s = [...hourEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const vis = s.length <= ROLLING_MOOD_WINDOW ? s : s.slice(-ROLLING_MOOD_WINDOW);
    return { sorted: s, visibleEntries: vis };
  }, [hourEntries]);

  if (sorted.length === 0) {
    return (
      <View
        style={[
          styles.chunk,
          styles.chunkEmpty,
          stripSelected && styles.emotionStripSelected,
        ]}
      />
    );
  }

  if (sorted.length === 1) {
    const one = visibleEntries[0];
    const bg = paletteFor(one.emotionId).bg;
    return (
      <View style={[styles.entryStripMultiWrap, stripSelected && styles.emotionStripSelected]}>
        <View style={[styles.moodFlowGradientFill, { backgroundColor: bg }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.1)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.moodFlowGradientFill, styles.moodFlowSoftOverlay]}
          pointerEvents="none"
        />
      </View>
    );
  }

  const bgColors = visibleEntries.map((e) => paletteFor(e.emotionId).bg);
  const { colors: gradColors, locations: gradLocations } = rollingWindowGradientStops(bgColors);

  return (
    <View style={[styles.entryStripMultiWrap, stripSelected && styles.emotionStripSelected]}>
      <LinearGradient
        colors={gradColors}
        locations={gradLocations}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.moodFlowGradientFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.1)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.moodFlowGradientFill, styles.moodFlowSoftOverlay]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlockPressable: {
    alignSelf: 'stretch',
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: notebook.ink,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 4,
  },
  dailySummaryWrap: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dailySummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkLight,
    lineHeight: 18,
    textAlign: 'center',
  },
  dateNavCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  calendarJump: {
    padding: 4,
  },
  date: {
    fontSize: 14,
    color: notebook.inkMuted,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  timelineScrollBottomTap: {
    minHeight: 160,
    width: '100%',
  },
  timelineLayer: {
    flex: 1,
    position: 'relative',
  },
  hourBlock: {
    marginBottom: 14,
  },
  chunkColFrame: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
  },
  emotionStripSelected: {
    borderWidth: 2,
    borderColor: 'rgba(79, 70, 229, 0.5)',
  },
  hourRowPressableInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
  },
  hourRowPressablePressed: {
    opacity: 0.9,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourEntryActionsWrap: {
    marginLeft: 60,
    paddingRight: 8,
  },
  hourLabelWrap: {
    width: 52,
    paddingTop: 12,
  },
  hourLabel: {
    fontSize: 13,
    color: notebook.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  chunkCol: {
    flex: 1,
    minWidth: 0,
  },
  chunkRow: {
    flexDirection: 'row',
    minHeight: 40,
  },
  chunk: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8ecf0',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chunkEmpty: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  entryStripMultiWrap: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  moodFlowGradientFill: {
    ...StyleSheet.absoluteFillObject,
  },
  moodFlowSoftOverlay: {
    opacity: 0.25,
  },
  memoPromptCard: {
    marginHorizontal: 8,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  memoPromptLine: {
    fontSize: 14,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
  },
  memoPromptSub: {
    marginTop: 4,
    fontSize: 12,
    color: notebook.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  memoPromptBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: notebook.ink,
  },
  memoPromptBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  emotionToastBanner: {
    alignSelf: 'stretch',
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  emotionToastText: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  firstGuideHint: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkMuted,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 19,
  },
  firstFollowRow: {
    alignSelf: 'stretch',
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  firstFollowQuestion: {
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  firstFollowActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  firstFollowBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  firstFollowBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4f46e5',
  },
  firstFollowBtnSecondary: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  firstFollowBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkLight,
  },
  footerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  footerHints: {
    marginBottom: 10,
    gap: 4,
  },
  footerHintText: {
    fontSize: 12,
    color: notebook.inkLight,
    textAlign: 'center',
    lineHeight: 18,
  },
  quickEmotionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 6,
  },
  quickEmotionRowDisabled: {
    opacity: 0.48,
  },
  quickFab: {
    flex: 1,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  quickFabLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
  },
});

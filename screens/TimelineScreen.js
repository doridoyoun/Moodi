import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  X,
} from 'lucide-react-native';
import NotebookLayout from '../components/NotebookLayout';
import { useMood } from '../src/context/MoodContext';
import { moodOrder, moodPalette, notebook, timelineSlotOverrides } from '../constants/theme';
import { formatDateKeyForDisplay, toDateKey } from '../storage/timelineStateStorage';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

/**
 * Rolling window: at most this many moods per hour cell, always the most recent by time.
 * Left = oldest visible, right = newest visible; older entries drop off the left when > 4.
 */
const ROLLING_MOOD_WINDOW = 4;

/** Stored memo: first line = title, rest = content */
function splitMemo(memo) {
  const raw = typeof memo === 'string' ? memo : '';
  if (!raw.trim()) return { title: '', content: '' };
  const nl = raw.indexOf('\n');
  if (nl === -1) return { title: raw.trim(), content: '' };
  return {
    title: raw.slice(0, nl).trim(),
    content: raw.slice(nl + 1).trim(),
  };
}

function joinMemo(title, content) {
  const t = (title || '').trim();
  const c = (content || '').trim();
  if (!t && !c) return '';
  if (!c) return t;
  if (!t) return c;
  return `${t}\n${c}`;
}

function formatEntryTime(iso) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** #RRGGBB + alpha for tinted backgrounds / softer text */
function hexToRgba(hex, alpha) {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return `rgba(61, 61, 61, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
  const {
    entries,
    selectedDate,
    shiftSelectedDateByDays,
    getEntriesForHour,
    createEntry,
    updateEntry,
    deleteEntry,
  } = useMood();

  const [activeHour, setActiveHour] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [detailEntryId, setDetailEntryId] = useState(null);
  const [isDetailEditing, setIsDetailEditing] = useState(false);
  const [detailEditEmotion, setDetailEditEmotion] = useState('happy');
  const [detailEditTitle, setDetailEditTitle] = useState('');
  const [detailEditContent, setDetailEditContent] = useState('');
  const [memoPromptEntryId, setMemoPromptEntryId] = useState(null);

  const overlayFade = useRef(new Animated.Value(0)).current;
  const overlaySlide = useRef(new Animated.Value(10)).current;
  const memoPromptTimerRef = useRef(null);

  const todayKey = toDateKey(new Date());
  const isToday = selectedDate === todayKey;

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
    setIsDetailEditing(true);
  }, [detailEntry]);

  const cancelDetailEdit = useCallback(() => {
    setIsDetailEditing(false);
    Keyboard.dismiss();
  }, []);

  const saveDetailEdit = useCallback(() => {
    const e = detailEntry;
    if (!e) return;
    const memo = joinMemo(detailEditTitle, detailEditContent);
    updateEntry(e.id, { emotionId: detailEditEmotion, memo });
    setIsDetailEditing(false);
    Keyboard.dismiss();
  }, [detailEditContent, detailEditEmotion, detailEditTitle, detailEntry, updateEntry]);

  const closeDetailModal = useCallback(() => {
    if (memoPromptTimerRef.current) {
      clearTimeout(memoPromptTimerRef.current);
      memoPromptTimerRef.current = null;
    }
    setMemoPromptEntryId(null);
    setDetailEntryId(null);
    setIsDetailEditing(false);
    Keyboard.dismiss();
  }, []);

  const onDetailModalRequestClose = useCallback(() => {
    if (isDetailEditing) {
      cancelDetailEdit();
    } else {
      closeDetailModal();
    }
  }, [cancelDetailEdit, closeDetailModal, isDetailEditing]);

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
      }
    });
  }, [overlayFade, overlaySlide]);

  const openEntryOverlayForHour = useCallback(
    (hour) => {
      if (overlayVisible && activeHour === hour) {
        closeEntryOverlay();
        return;
      }
      setActiveHour(hour);
      setOverlayVisible(true);
    },
    [activeHour, closeEntryOverlay, overlayVisible],
  );

  useEffect(() => {
    if (!overlayVisible || activeHour === null) return;
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

  const overlayTitledEntries = useMemo(
    () =>
      overlaySortedEntries.filter((e) => (splitMemo(e.memo).title || '').trim().length > 0),
    [overlaySortedEntries],
  );

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
    setIsDetailEditing(true);
  }, [entries, memoPromptEntryId]);

  const onQuickEmotion = useCallback(
    (emotionId) => {
      if (!isToday) return;
      const hour = new Date().getHours();
      const entry = createEntry({
        emotionId,
        memo: '',
        dateKey: todayKey,
        hour,
      });
      if (entry?.id) {
        if (memoPromptTimerRef.current) {
          clearTimeout(memoPromptTimerRef.current);
        }
        setMemoPromptEntryId(entry.id);
        memoPromptTimerRef.current = setTimeout(() => {
          memoPromptTimerRef.current = null;
          setMemoPromptEntryId((cur) => (cur === entry.id ? null : cur));
        }, 3000);
      }
    },
    [createEntry, isToday, todayKey],
  );

  useEffect(
    () => () => {
      if (memoPromptTimerRef.current) {
        clearTimeout(memoPromptTimerRef.current);
      }
    },
    [],
  );

  const dateLabel = useMemo(
    () => formatDateKeyForDisplay(selectedDate, 'ko-KR'),
    [selectedDate],
  );

  const scrollRef = useRef(null);
  const hourYRef = useRef({});
  const hourRowHeightRef = useRef(54);
  const scrollViewportHRef = useRef(0);

  const scrollToCurrentHour = useCallback(() => {
    if (!isToday) return;
    const h = new Date().getHours();
    const y = hourYRef.current[h];
    const rowH = hourRowHeightRef.current;
    const vh = scrollViewportHRef.current;
    if (scrollRef.current == null || y == null || vh <= 0) return;
    const targetY = y - vh / 2 + rowH / 2;
    scrollRef.current.scrollTo({ y: Math.max(0, targetY), animated: false });
  }, [isToday]);

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

  const detailSplit = detailEntry ? splitMemo(detailEntry.memo) : { title: '', content: '' };
  const detailEmotionLabel =
    detailEntry && moodPalette[detailEntry.emotionId]
      ? moodPalette[detailEntry.emotionId].label
      : '';
  const detailEmotionPal = detailEntry
    ? moodPalette[detailEntry.emotionId] ?? moodPalette.happy
    : moodPalette.happy;

  return (
    <NotebookLayout
      footer={
        <View style={styles.footerWrap}>
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
            <Text style={styles.footerQuickHint}>빠르게 지금 감정 기록</Text>
            <Text style={styles.footerHintText}>
              아래 감정을 눌러 오늘의 기분을 남겨요
            </Text>
          </View>
          <View style={[styles.quickEmotionRow, !isToday && styles.quickEmotionRowDisabled]}>
            {moodOrder.map((key) => {
              const Icon = moodIcons[key];
              const m = moodPalette[key];
              return (
                <Pressable
                  key={key}
                  disabled={!isToday}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  onPress={() => onQuickEmotion(key)}
                  style={({ pressed }) => [
                    styles.quickFab,
                    { backgroundColor: m.bg, borderColor: m.border },
                    pressed && isToday && { opacity: 0.85 },
                  ]}
                >
                  <Icon size={22} color={m.ink} strokeWidth={2} />
                  <Text style={[styles.quickFabLabel, { color: m.ink }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
    >
      <View style={styles.timelineLayer}>
        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>{"⭐ 오늘의 감정 기록"}</Text>

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
        </View>
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
              overlayOpen={overlayVisible && activeHour === hour}
              onToggleOverlay={() => openEntryOverlayForHour(hour)}
              onLayoutHour={(y, height) => {
                hourYRef.current[hour] = y;
                hourRowHeightRef.current = height;
              }}
            />
          ))}
        </ScrollView>

        {overlayVisible && activeHour !== null ? (
          <View style={styles.entryOverlayRoot} pointerEvents="box-none">
            <Animated.View
              style={[styles.entryOverlayDim, { opacity: overlayFade }]}
              pointerEvents="auto"
            >
              <Pressable style={StyleSheet.absoluteFillObject} onPress={closeEntryOverlay} />
            </Animated.View>
            <View pointerEvents="box-none" style={styles.entryOverlayCardWrap}>
              <Animated.View
                style={[
                  styles.entryOverlayCard,
                  {
                    opacity: overlayFade,
                    transform: [{ translateY: overlaySlide }],
                  },
                ]}
              >
                <Text style={styles.entryOverlayHeading}>
                  {String(activeHour).padStart(2, '0')}:00 메모
                </Text>
                <ScrollView
                  style={styles.entryOverlayList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {overlayTitledEntries.length === 0 ? (
                    <Text style={styles.entryOverlayEmpty}>아직 메모가 없어요</Text>
                  ) : (
                    overlayTitledEntries.map((entry) => {
                      const { title } = splitMemo(entry.memo);
                      const titleLine = (title || '').trim();
                      return (
                        <Pressable
                          key={entry.id}
                          onPress={() => openDetailFromOverlay(entry.id)}
                          style={({ pressed }) => [
                            styles.entryOverlayRow,
                            pressed && styles.entryOverlayRowPressed,
                          ]}
                          accessibilityLabel={titleLine}
                        >
                          <Text
                            style={styles.entryOverlayItemLine}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {titleLine}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </Animated.View>
            </View>
          </View>
        ) : null}
      </View>

      <Modal
        visible={detailEntry != null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onDetailModalRequestClose}
      >
        <SafeAreaView style={styles.detailModalRoot} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.detailHeader}>
            <Pressable
              onPress={closeDetailModal}
              style={styles.detailCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <X size={26} color={notebook.ink} strokeWidth={2} />
            </Pressable>
          </View>
          {detailEntry && !isDetailEditing ? (
            <>
              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.detailMetaRow}>
                  <View
                    style={[
                      styles.detailEmotionPill,
                      {
                        backgroundColor: hexToRgba(detailEmotionPal.bg, 0.22),
                        borderColor: hexToRgba(detailEmotionPal.border, 0.35),
                      },
                    ]}
                  >
                    <Text style={[styles.detailEmotionPillLabel, { color: detailEmotionPal.ink }]}>
                      {detailEmotionLabel}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.detailTimeText,
                      { color: hexToRgba(detailEmotionPal.ink, 0.62) },
                    ]}
                  >
                    {formatEntryTime(detailEntry.createdAt)}
                  </Text>
                </View>
                {detailSplit.title ? (
                  <Text style={styles.detailTitle}>{detailSplit.title}</Text>
                ) : null}
                {detailSplit.content ? (
                  <Text style={styles.detailBody}>{detailSplit.content}</Text>
                ) : !detailSplit.title ? (
                  <Text style={styles.detailBodyMuted}>(내용 없음)</Text>
                ) : null}
              </ScrollView>
              <View style={styles.detailFooter}>
                <Pressable
                  style={({ pressed }) => [styles.detailBtnSecondary, pressed && { opacity: 0.88 }]}
                  onPress={beginDetailEdit}
                >
                  <Text style={styles.detailBtnSecondaryText}>수정</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.detailBtnDanger, pressed && { opacity: 0.88 }]}
                  onPress={() => detailEntry && confirmDeleteEntry(detailEntry.id)}
                >
                  <Text style={styles.detailBtnDangerText}>삭제</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {detailEntry && isDetailEditing ? (
            <KeyboardAvoidingView
              style={styles.detailEditKeyboard}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailEditScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.detailEditEmotionRow}>
                  {moodOrder.map((key) => {
                    const Icon = moodIcons[key];
                    const m = moodPalette[key];
                    const selected = detailEditEmotion === key;
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        accessibilityLabel={m.label}
                        onPress={() => setDetailEditEmotion(key)}
                        style={({ pressed }) => [
                          styles.detailEditFab,
                          { backgroundColor: m.bg, borderColor: m.border },
                          selected && styles.detailEditFabSelected,
                          pressed && { opacity: 0.88 },
                        ]}
                      >
                        <Icon size={17} color={m.ink} strokeWidth={2} />
                        <Text style={[styles.detailEditFabLabel, { color: m.ink }]}>{m.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.detailEditTitleInput}
                  placeholder="제목 (선택)"
                  placeholderTextColor={notebook.inkLight}
                  value={detailEditTitle}
                  onChangeText={setDetailEditTitle}
                  maxLength={200}
                />
                <TextInput
                  style={styles.detailEditMemoInput}
                  placeholder="내용 (선택)"
                  placeholderTextColor={notebook.inkLight}
                  value={detailEditContent}
                  onChangeText={setDetailEditContent}
                  multiline
                  maxLength={500}
                />
              </ScrollView>
              <View style={styles.detailFooter}>
                <Pressable
                  style={({ pressed }) => [styles.detailBtnSecondary, pressed && { opacity: 0.88 }]}
                  onPress={cancelDetailEdit}
                >
                  <Text style={styles.detailBtnSecondaryText}>취소</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.detailBtnPrimaryFull, pressed && { opacity: 0.9 }]}
                  onPress={saveDetailEdit}
                >
                  <Text style={styles.detailBtnPrimaryFullText}>저장</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </NotebookLayout>
  );
}

function HourRowBlock({
  hour,
  hourEntries,
  overlayOpen,
  onToggleOverlay,
  onLayoutHour,
}) {
  const n = hourEntries.length;

  return (
    <View
      style={styles.hourBlock}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onLayoutHour(y, height);
      }}
    >
      <View style={styles.hourRow}>
        <View style={styles.hourLabelWrap}>
          <Text style={styles.hourLabel}>
            {String(hour).padStart(2, '0')}:00
          </Text>
        </View>
        <View style={styles.chunkCol}>
          <View style={styles.chunkRow} accessibilityLabel={`${String(hour).padStart(2, '0')}시 감정 바`}>
            <EntryStrip hourEntries={hourEntries} />
          </View>
          {n > 0 ? (
            <Pressable
              onPress={onToggleOverlay}
              style={styles.entrySummaryTap}
              accessibilityRole="button"
              accessibilityLabel={overlayOpen ? '메모 닫기' : '메모 보기'}
            >
              <Text style={styles.entrySummaryText}>
                {overlayOpen ? '메모 닫기 ▲' : '메모 보기 ▼'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function EntryStrip({ hourEntries }) {
  const { sorted, visibleEntries } = useMemo(() => {
    const s = [...hourEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const vis = s.length <= ROLLING_MOOD_WINDOW ? s : s.slice(-ROLLING_MOOD_WINDOW);
    return { sorted: s, visibleEntries: vis };
  }, [hourEntries]);

  if (sorted.length === 0) {
    return <View style={[styles.chunk, styles.chunkEmpty]} />;
  }

  if (sorted.length === 1) {
    const one = visibleEntries[0];
    const bg = paletteFor(one.emotionId).bg;
    return (
      <View style={styles.entryStripMultiWrap}>
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
    <View style={styles.entryStripMultiWrap}>
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

function paletteFor(emotionId) {
  const base = moodPalette[emotionId] ? { ...moodPalette[emotionId] } : { ...moodPalette.happy };
  const o = timelineSlotOverrides[emotionId];
  if (o?.bg) base.bg = o.bg;
  if (o?.border) base.border = o.border;
  return base;
}

const styles = StyleSheet.create({
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
  timelineLayer: {
    flex: 1,
    position: 'relative',
  },
  hourBlock: {
    marginBottom: 14,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginLeft: 8,
    minWidth: 0,
  },
  chunkRow: {
    flexDirection: 'row',
    minHeight: 40,
  },
  entrySummaryTap: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  entrySummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkMuted,
  },
  entryOverlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  entryOverlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  entryOverlayCardWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 51,
  },
  entryOverlayCard: {
    width: SCREEN_W * 0.85,
    maxHeight: SCREEN_H * 0.48,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  entryOverlayHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: notebook.ink,
    letterSpacing: 0.15,
    marginBottom: 14,
  },
  entryOverlayList: {
    maxHeight: SCREEN_H * 0.36,
  },
  entryOverlayRow: {
    paddingVertical: 8,
    marginBottom: 6,
  },
  entryOverlayRowPressed: {
    opacity: 0.85,
  },
  entryOverlayItemLine: {
    fontSize: 15,
    fontWeight: '500',
    color: notebook.ink,
    lineHeight: 22,
  },
  entryOverlayEmpty: {
    fontSize: 13,
    color: notebook.inkLight,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    lineHeight: 20,
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
  footerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  footerHints: {
    marginBottom: 10,
    gap: 4,
  },
  footerQuickHint: {
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
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
  detailModalRoot: {
    flex: 1,
    backgroundColor: notebook.bg,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  detailCloseBtn: {
    padding: 10,
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  detailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  detailEmotionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  detailEmotionPillLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  detailTimeText: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: notebook.ink,
    lineHeight: 30,
    marginBottom: 16,
  },
  detailBody: {
    fontSize: 16,
    lineHeight: 26,
    color: notebook.ink,
  },
  detailBodyMuted: {
    fontSize: 15,
    color: notebook.inkLight,
    fontStyle: 'italic',
  },
  detailFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  detailBtnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: notebook.gridLine,
    backgroundColor: '#fff',
  },
  detailBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: notebook.ink,
  },
  detailBtnDanger: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(180, 40, 40, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(180, 40, 40, 0.35)',
  },
  detailBtnDangerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#b91c1c',
  },
  detailEditKeyboard: {
    flex: 1,
  },
  detailEditScrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  detailEditEmotionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 16,
  },
  detailEditFab: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 1,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  detailEditFabSelected: {
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  detailEditFabLabel: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '600',
  },
  detailEditTitleInput: {
    borderWidth: 1,
    borderColor: notebook.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: notebook.ink,
    backgroundColor: notebook.bg,
    marginBottom: 10,
  },
  detailEditMemoInput: {
    minHeight: 120,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: notebook.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: notebook.ink,
    backgroundColor: notebook.bg,
    textAlignVertical: 'top',
  },
  detailBtnPrimaryFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: notebook.ink,
  },
  detailBtnPrimaryFullText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

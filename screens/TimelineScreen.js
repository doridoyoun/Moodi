import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import NotebookLayout from '../components/NotebookLayout';
import { useMood } from '../src/context/MoodContext';
import { moodOrder, moodPalette, notebook, timelineSlotOverrides } from '../constants/theme';
import {
  createEmptyChunks,
  createEmptyHourMap,
  formatDateKeyForDisplay,
  toDateKey,
} from '../storage/timelineStateStorage';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

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
    timelineByDate,
    selectedDate,
    shiftSelectedDateByDays,
    applyEmotionForCurrentHour,
  } = useMood();

  const hourChunksMap = useMemo(() => {
    return timelineByDate[selectedDate] ?? createEmptyHourMap();
  }, [timelineByDate, selectedDate]);

  const todayKey = toDateKey(new Date());
  const isToday = selectedDate === todayKey;

  const onEmotion = useCallback(
    (emotionId) => {
      if (!isToday) return;
      applyEmotionForCurrentHour(emotionId);
    },
    [applyEmotionForCurrentHour, isToday],
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

  return (
    <NotebookLayout
      footer={
        <View style={[styles.fabRow, !isToday && styles.fabRowDisabled]}>
          {moodOrder.map((key) => {
            const Icon = moodIcons[key];
            const m = moodPalette[key];
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                disabled={!isToday}
                onPress={() => onEmotion(key)}
                style={({ pressed }) => [
                  styles.fab,
                  { backgroundColor: m.bg, borderColor: m.border },
                  pressed && isToday && { opacity: 0.85 },
                ]}
              >
                <Icon size={22} color={m.ink} strokeWidth={2} />
                <Text style={[styles.fabLabel, { color: m.ink }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      }
    >
      <View style={styles.titleBlock}>
        <Text style={styles.pageTitle}>{"⭐ Today's Mood Timeline"}</Text>

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

        {!isToday ? (
          <Text style={styles.hint}>과거·미래 날짜는 조회만 가능해요. 오늘로 이동하면 기록할 수 있어요.</Text>
        ) : null}
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
        {HOURS.map((hour) => {
          const row = hourChunksMap[hour] ?? createEmptyChunks();
          return (
            <View
              key={hour}
              style={styles.hourRow}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                hourYRef.current[hour] = y;
                hourRowHeightRef.current = height;
              }}
            >
              <Text style={styles.hourLabel}>
                {String(hour).padStart(2, '0')}:00
              </Text>
              <View style={styles.chunkRow}>
                {row.map((cell, chunkIdx) => (
                  <ChunkCell key={`${selectedDate}-${hour}-${chunkIdx}`} cell={cell} />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </NotebookLayout>
  );
}

/** #RRGGBB 두 색을 t(0~1) 비율로 혼합 — 같은 톤 안에서 테두리만 살짝 진하게 */
function mixHex(from, to, t) {
  const p = (h) => {
    const s = h.replace('#', '');
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  };
  const a = p(from);
  const b = p(to);
  const x = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(x(0))}${h(x(1))}${h(x(2))}`;
}

function clampChunkCount(n) {
  const c = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 1;
  return Math.min(3, Math.max(1, c));
}

/** 짜증: ink(#7a2e1f)로 섞으면 갈색으로 치우침 → 코랄·오렌지레드 쪽만 진하게 */
const ANNOYED_CORAL_MID = '#ff7a6b';
const ANNOYED_CORAL_DEEP = '#ff5c4d';

/** count 1~3: 테두리가 주 신호, 배경은 보조 (Context mergeChunkManual과 동일 상한) */
function chunkIntensityVisuals(pal, emotionId, count) {
  const level = clampChunkCount(count);
  let borderColor;
  if (emotionId === 'annoyed') {
    if (level <= 1) borderColor = pal.border;
    else if (level === 2) borderColor = mixHex(pal.border, ANNOYED_CORAL_MID, 0.42);
    else borderColor = mixHex(ANNOYED_CORAL_MID, ANNOYED_CORAL_DEEP, 0.55);
  } else {
    borderColor =
      level <= 1
        ? pal.border
        : level === 2
          ? mixHex(pal.border, pal.ink, 0.3)
          : mixHex(pal.border, pal.ink, 0.5);
  }
  const borderWidth = level <= 1 ? 1.5 : level === 2 ? 1.65 : 1.85;
  const fillOpacity = level <= 1 ? 0.12 : level === 2 ? 0.16 : 0.2;
  return { borderColor, borderWidth, fillOpacity };
}

function ChunkCell({ cell }) {
  const eid = cell?.emotionId;
  const pal =
    cell && eid && moodPalette[eid]
      ? { ...moodPalette[eid], ...(timelineSlotOverrides[eid] ?? {}) }
      : null;
  const Icon = cell ? moodIcons[cell.emotionId] : null;
  const memo = cell?.memo?.trim();
  const filled = Boolean(cell && pal && Icon);
  const intensity =
    filled && pal ? chunkIntensityVisuals(pal, cell.emotionId, cell.count) : null;

  return (
    <View
      style={[
        styles.chunk,
        filled &&
          intensity && {
            borderWidth: intensity.borderWidth,
            borderColor: intensity.borderColor,
          },
      ]}
    >
      {filled ? (
        <>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 8,
                backgroundColor: pal.bg,
                opacity: intensity.fillOpacity,
              },
            ]}
          />
          <View style={styles.chunkBody}>
            <Icon size={14} color={pal.ink} strokeWidth={2} />
            {memo ? (
              <Text style={[styles.chunkMemo, { color: pal.ink }]} numberOfLines={1}>
                {memo}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
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
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: notebook.inkLight,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  hourLabel: {
    width: 52,
    fontSize: 13,
    color: notebook.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  chunkRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    marginLeft: 8,
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
  chunkBody: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 1,
  },
  chunkMemo: {
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: '100%',
  },
  fabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
  },
  fabRowDisabled: {
    opacity: 0.5,
  },
  fab: {
    flex: 1,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  fabLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
  },
});

import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Surface } from 'react-native-paper';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import NotebookLayout from '../components/NotebookLayout';
import { useMood } from '../src/context/MoodContext';
import { moodOrder, moodPalette, notebook } from '../constants/theme';
import {
  computeTopTwoEmotionIdsFromEntries,
  getEntriesForDate,
  parseDateKey,
  toDateKey,
} from '../storage/timelineStateStorage';
import { countEmotionsByTopCategoryForDay } from '../utils/monthlyFlowHelpers';
import { computeDailyAnalysis } from '../utils/dailyAnalysis';
import { formatEntryTime, splitMemo } from '../utils/timelineEntryFormat';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function normalizeImageUri(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  // Accept common RN/Expo URI schemes.
  if (/^(https?:|file:|content:|ph:|assets-library:|blob:|data:)/i.test(s)) return s;
  // Also allow bare absolute paths on some platforms.
  if (/^[a-zA-Z]:\\/.test(s)) return s;
  return null;
}

function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(d);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function dateKeyForDay(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${m}-${dd}`;
}

function formatShortMd(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return '';
  return `${p.monthIndex + 1}/${String(p.day).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const navigation = useNavigation();
  const { entries, selectedDate, setSelectedDate, setRepresentativeOverrideForDate } = useMood();
  const [cursor, setCursor] = useState(() => new Date());
  const [repPhotoFailed, setRepPhotoFailed] = useState(false);
  const [oneLinePickerVisible, setOneLinePickerVisible] = useState(false);

  useEffect(() => {
    const p = parseDateKey(selectedDate);
    if (!p) return;
    setCursor((c) => {
      if (c.getFullYear() === p.year && c.getMonth() === p.monthIndex) return c;
      return new Date(p.year, p.monthIndex, 1);
    });
  }, [selectedDate]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();

  const monthLabel = useMemo(
    () =>
      cursor.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
      }),
    [cursor],
  );

  const cells = useMemo(
    () => buildMonthGrid(year, monthIndex),
    [year, monthIndex],
  );

  const selectedDayEmotionCounts = useMemo(
    () => countEmotionsByTopCategoryForDay(entries, selectedDate),
    [entries, selectedDate],
  );

  const selectedDayEmotionTotal = useMemo(
    () => moodOrder.reduce((sum, id) => sum + (selectedDayEmotionCounts[id] ?? 0), 0),
    [selectedDayEmotionCounts],
  );

  const analysis = computeDailyAnalysis(entries, selectedDate);

  const summaryText = useMemo(() => {
    const s = typeof analysis?.oneLineSummary === 'string' ? analysis.oneLineSummary.trim() : '';
    return s || '아직 이 날의 요약이 없어요';
  }, [analysis]);

  const repEmotionId =
    analysis?.representativeEmotion && typeof analysis.representativeEmotion === 'string'
      ? analysis.representativeEmotion
      : null;

  const memoSource = analysis?.representativeMemoSource ?? null;
  const memoEmotionId =
    memoSource?.emotionId && typeof memoSource.emotionId === 'string' ? memoSource.emotionId : null;
  const memoEmotionLabel =
    memoEmotionId && moodPalette[memoEmotionId] ? moodPalette[memoEmotionId].label : '';
  const memoTimeText =
    memoSource?.createdAt && typeof memoSource.createdAt === 'string'
      ? formatEntryTime(memoSource.createdAt)
      : '';

  const representativeMemo =
    analysis?.representativeMemo && typeof analysis.representativeMemo === 'string'
      ? analysis.representativeMemo
      : null;
  const representativePhoto =
    analysis?.representativePhotoUri && typeof analysis.representativePhotoUri === 'string'
      ? analysis.representativePhotoUri
      : null;

  const hasRepresentativeMemo = Boolean(representativeMemo && representativeMemo.trim().length > 0);

  const repMemoParts = representativeMemo ? splitMemo(representativeMemo) : { title: '', content: '' };
  const repMemoTitle = (repMemoParts.title || '').trim();
  const repMemoBody = (repMemoParts.content || '').trim();

  const repCardTitle = useMemo(() => {
    if (repMemoTitle) return repMemoTitle;
    const src = repMemoBody || (representativeMemo || '').trim();
    if (!src) return '';
    const oneLine = src.split('\n').map((x) => x.trim()).find(Boolean) || '';
    return oneLine.length > 30 ? `${oneLine.slice(0, 30).trim()}…` : oneLine;
  }, [repMemoBody, repMemoTitle, representativeMemo]);

  const repPhotoUri = representativePhoto || '';

  const repPhotoUriNormalized = useMemo(() => normalizeImageUri(repPhotoUri), [repPhotoUri]);

  useEffect(() => {
    setRepPhotoFailed(false);
  }, [repPhotoUriNormalized]);

  const repEmotionLabel =
    repEmotionId && moodPalette[repEmotionId] ? moodPalette[repEmotionId].label : '';

  const repEmotionFallbackText = useMemo(() => {
    switch (repEmotionId) {
      case 'happy':
        return '오늘은 기분 좋은 감정이 가장 많이 남았어요';
      case 'flutter':
        return '오늘은 설레는 감정이 가장 많이 남았어요';
      case 'calm':
        return '오늘은 평온한 감정이 가장 많이 남았어요';
      case 'gloom':
        return '오늘은 가라앉은 감정이 가장 많이 남았어요';
      case 'annoyed':
        return '오늘은 짜증나는 감정이 가장 많이 남았어요';
      default:
        return '이 날의 대표 순간이 아직 없어요';
    }
  }, [repEmotionId]);

  const shiftMonth = (delta) => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const onPressDayCell = (day) => {
    const key = dateKeyForDay(year, monthIndex, day);
    setSelectedDate(key);
  };

  const dayEntries = useMemo(() => getEntriesForDate(entries, selectedDate), [entries, selectedDate]);
  const daySorted = useMemo(
    () => [...dayEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [dayEntries],
  );
  const oneLineCandidates = useMemo(() => {
    return daySorted
      .map((e) => {
        const memoRaw = typeof e?.memo === 'string' ? e.memo.trim() : '';
        const parts = splitMemo(memoRaw);
        const title = (parts.title || '').trim();
        const content = (parts.content || '').trim();
        const firstLine = content.split('\n').map((x) => x.trim()).find(Boolean) || '';

        if (!title && !firstLine) return null;

        return {
          id: e?.id ?? `${e?.createdAt || ''}-${e?.emotionId || ''}`,
          entryId: e?.id ?? null,
          timeText: formatEntryTime(e?.createdAt),
          preview: title || firstLine,
        };
      })
      .filter(Boolean);
  }, [daySorted]);

  return (
    <NotebookLayout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pagePad}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.emoji}>📅</Text>
          <Text style={styles.pageTitle}>Mood Calendar</Text>
        </View>

        <Surface style={styles.card} elevation={2}>
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="이전 달"
            >
              <ChevronLeft size={22} color={notebook.inkMuted} />
            </Pressable>
            <Text style={styles.monthText}>{monthLabel}</Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="다음 달"
            >
              <ChevronRight size={22} color={notebook.inkMuted} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day == null) {
                return <View key={`e-${idx}`} style={styles.cell} />;
              }
              const key = dateKeyForDay(year, monthIndex, day);
              const todayKey = toDateKey(new Date());
              const isTodayCell = key === todayKey;
              const isSelectedCell = key === selectedDate;
              const topTwo = computeTopTwoEmotionIdsFromEntries(entries, key);
              const fallbackA = 'rgba(255,255,255,0.55)';
              const fallbackB = 'rgba(247,250,252,0.95)';
              let gradientColors;
              if (topTwo.length === 0) {
                gradientColors = [fallbackA, fallbackB];
              } else if (topTwo.length === 1) {
                const c = moodPalette[topTwo[0]]?.bg ?? fallbackA;
                gradientColors = [c, c];
              } else {
                const c0 = moodPalette[topTwo[0]]?.bg ?? fallbackA;
                const c1 = moodPalette[topTwo[1]]?.bg ?? c0;
                gradientColors = [c0, c1];
              }

              return (
                <View key={`d-${day}`} style={styles.cell}>
                  <Pressable
                    onPress={() => onPressDayCell(day)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      isTodayCell && !isSelectedCell && styles.dayCellToday,
                      isSelectedCell && styles.dayCellSelected,
                      pressed && styles.dayPressActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${day}일, 타임라인으로 이동`}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text
                      style={[
                        styles.dayText,
                        { color: topTwo.length ? notebook.ink : notebook.inkMuted },
                        isSelectedCell && styles.dayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.selectedDetail}>
            <Text style={styles.selectedDetailTitle}>선택한 날</Text>
            {selectedDayEmotionTotal === 0 ? (
              <Text style={styles.selectedEmpty}>기록이 없어요</Text>
            ) : (
              <View style={styles.selectedPreviewRow}>
                <Text style={styles.selectedPreviewDate}>{formatShortMd(selectedDate)}</Text>
                <View style={styles.previewBarWrap}>
                  <View style={styles.previewBarRow}>
                    {moodOrder.map((emotionId) => {
                      const n = selectedDayEmotionCounts[emotionId] ?? 0;
                      return (
                        <View
                          key={`pv-${selectedDate}-${emotionId}`}
                          style={[
                            styles.previewSegment,
                            {
                              flex: n > 0 ? n : 0,
                              backgroundColor: moodPalette[emotionId].bg,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.calendarSummaryWrap}>
            <Text style={styles.calendarSummaryText}>{summaryText}</Text>
          </View>

          {selectedDayEmotionTotal > 0 ? (
            <Pressable
              onPress={() => navigation.navigate('DailyAnalysis')}
              style={({ pressed }) => [styles.analysisEntry, pressed && styles.analysisEntryPressed]}
              accessibilityRole="button"
              accessibilityLabel="선택한 날 하루 분석"
            >
              <Text style={styles.analysisEntryText}>하루 분석 보기</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setOneLinePickerVisible(true)}
            style={({ pressed }) => [styles.repCardWrap, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel="오늘의 한 줄 선택"
          >
            <View style={styles.repCardHeader}>
              <Text style={styles.repCardEmotion}>오늘의 한 줄</Text>
              {memoTimeText ? <Text style={styles.repCardTime}>{memoTimeText}</Text> : null}
            </View>

            {hasRepresentativeMemo ? (
              <>
                {repCardTitle ? <Text style={styles.repCardTitle}>{repCardTitle}</Text> : null}
                {repPhotoUriNormalized && !repPhotoFailed ? (
                  <Image
                    source={{ uri: repPhotoUriNormalized }}
                    style={styles.repCardPhoto}
                    resizeMode="cover"
                    accessibilityLabel="오늘의 한 줄 사진"
                    onError={() => setRepPhotoFailed(true)}
                  />
                ) : null}
              </>
            ) : repEmotionId ? (
              <Text style={styles.repCardTitle}>{repEmotionFallbackText}</Text>
            ) : (
              <Text style={styles.repEmptyText}>오늘의 한 줄을 선택해보세요</Text>
            )}
          </Pressable>

          <Modal
            visible={oneLinePickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setOneLinePickerVisible(false)}
          >
            <View style={styles.oneLineModalRoot}>
              <Pressable
                style={styles.oneLineModalBackdrop}
                onPress={() => setOneLinePickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              />
              <View style={styles.oneLineModalCard}>
                <Text style={styles.oneLineModalTitle}>오늘의 한 줄</Text>
                <Text style={styles.oneLineModalSub}>오늘 기록 중 하나를 선택하세요</Text>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                  {oneLineCandidates.length === 0 ? (
                    <Text style={styles.oneLineModalEmpty}>선택할 메모가 아직 없어요</Text>
                  ) : (
                    oneLineCandidates.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          if (!item.entryId) return;
                          setRepresentativeOverrideForDate(selectedDate, item.entryId);
                          setOneLinePickerVisible(false);
                        }}
                        style={({ pressed }) => [styles.oneLineItem, pressed && { opacity: 0.88 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.timeText} 선택`}
                      >
                        <Text style={styles.oneLineItemTime}>{item.timeText}</Text>
                        <Text style={styles.oneLineItemText} numberOfLines={2}>
                          {item.preview}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <View style={styles.legend}>
            {moodOrder.map((k) => {
              const m = moodPalette[k];
              return (
                <View key={k} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: m.bg, borderColor: m.border }]} />
                  <Text style={styles.legendText}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </Surface>
      </ScrollView>
    </NotebookLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  pagePad: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  emoji: {
    fontSize: 18,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: notebook.ink,
  },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: notebook.gridLine,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 14,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '800',
    color: notebook.ink,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
    color: notebook.inkLight,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    paddingVertical: 3,
    paddingHorizontal: 2,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  dayCell: {
    minHeight: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: 'rgba(79, 70, 229, 0.35)',
  },
  dayCellSelected: {
    borderWidth: 2,
    borderColor: 'rgba(79, 70, 229, 0.52)',
  },
  dayPressActive: {
    opacity: 0.82,
  },
  dayText: {
    position: 'relative',
    zIndex: 2,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  dayTextSelected: {
    fontWeight: '800',
    color: '#2d3748',
  },
  selectedDetail: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
  },
  selectedDetailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: notebook.inkLight,
    marginBottom: 8,
  },
  selectedEmpty: {
    fontSize: 14,
    fontWeight: '600',
    color: notebook.inkLight,
    fontStyle: 'italic',
  },
  selectedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedPreviewDate: {
    width: 44,
    fontSize: 15,
    fontWeight: '800',
    color: notebook.ink,
    fontVariant: ['tabular-nums'],
  },
  previewBarWrap: {
    flex: 1,
    minWidth: 0,
  },
  previewBarRow: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  previewSegment: {
    minWidth: 0,
  },
  previewBarEmpty: {
    height: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  calendarSummaryWrap: {
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  calendarSummaryText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: notebook.inkMuted,
    fontWeight: '600',
  },
  analysisEntry: {
    marginTop: 12,
    alignSelf: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 10,
  },
  analysisEntryPressed: {
    opacity: 0.75,
  },
  analysisEntryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f766e',
  },
  repCardWrap: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
    padding: 16,
  },
  repCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  repCardEmotion: {
    fontSize: 13,
    fontWeight: '700',
    color: notebook.inkMuted,
  },
  repCardTime: {
    fontSize: 12,
    color: notebook.inkLight,
  },
  repCardTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: notebook.ink,
  },
  repCardPhoto: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: notebook.gridLine,
  },
  repEmptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: notebook.inkLight,
    textAlign: 'center',
  },
  oneLineModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  oneLineModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  oneLineModalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    maxHeight: '78%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  oneLineModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: notebook.ink,
    textAlign: 'center',
  },
  oneLineModalSub: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkMuted,
    textAlign: 'center',
  },
  oneLineModalEmpty: {
    textAlign: 'center',
    color: notebook.inkLight,
    paddingVertical: 18,
    fontWeight: '600',
  },
  oneLineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
  },
  oneLineItemTime: {
    width: 48,
    fontSize: 12,
    color: notebook.inkLight,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  oneLineItemText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
    color: notebook.ink,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 11,
    color: notebook.inkMuted,
    fontWeight: '600',
  },
});

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmotionFlowGraph from '../components/analysis/EmotionFlowGraph';
import { useMood } from '../src/context/MoodContext';
import { notebook } from '../constants/theme';
import { computeDailyAnalysis, emotionYValue, normEmotionId } from '../utils/dailyAnalysis';
import { formatDateKeyForDisplay, getEntriesForDate, getEntryTimelineHour } from '../storage/timelineStateStorage';
import { formatEntryTime, splitMemo } from '../utils/timelineEntryFormat';

const MAX_SEGMENT_SIZE = 6;

export default function DailyAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { entries, selectedDate } = useMood();
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(null);

  const analysis = useMemo(
    () => computeDailyAnalysis(entries, selectedDate),
    [entries, selectedDate],
  );

  const dateTitle = useMemo(
    () => formatDateKeyForDisplay(selectedDate, 'ko-KR'),
    [selectedDate],
  );

  const dayEntries = useMemo(
    () => getEntriesForDate(entries, selectedDate),
    [entries, selectedDate],
  );

  const daySorted = useMemo(
    () => [...dayEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [dayEntries],
  );

  useEffect(() => {
    setSelectedSegmentIndex(null);
  }, [selectedDate]);

  const emotionSegments = useMemo(() => {
    if (!daySorted.length) return [];
    /** @type {{ emotionId: string, count: number, startCreatedAt: string, entries: any[] }[]} */
    const segs = [];
    /** @type {{ emotionId: string, entries: any[] } | null} */
    let run = null;

    const flushRunIntoChunks = () => {
      if (!run || run.entries.length === 0) return;
      const list = run.entries;
      for (let i = 0; i < list.length; i += MAX_SEGMENT_SIZE) {
        const chunk = list.slice(i, i + MAX_SEGMENT_SIZE);
        if (!chunk.length) continue;
        segs.push({
          emotionId: run.emotionId,
          count: chunk.length,
          startCreatedAt: chunk[0].createdAt,
          entries: chunk,
        });
      }
    };

    for (const e of daySorted) {
      const eid = normEmotionId(e?.emotionId);
      if (!run || run.emotionId !== eid) {
        flushRunIntoChunks();
        run = { emotionId: eid, entries: [e] };
      } else {
        run.entries.push(e);
      }
    }
    flushRunIntoChunks();

    return segs;
  }, [daySorted]);

  const segmentFlowGraph = useMemo(() => {
    const n = emotionSegments.length;
    if (n === 0) return { kind: 'single', points: [] };

    const times = emotionSegments
      .map((s) => Date.parse(s.startCreatedAt))
      .filter((t) => Number.isFinite(t));
    const minT = times.length ? Math.min(...times) : NaN;
    const maxT = times.length ? Math.max(...times) : NaN;
    const span = Number.isFinite(minT) && Number.isFinite(maxT) ? maxT - minT : 0;

    const points = emotionSegments.map((seg, idx) => {
      const t = Date.parse(seg.startCreatedAt);
      const xRatio =
        n === 1
          ? 0.5
          : Number.isFinite(t) && span > 0
            ? Math.min(1, Math.max(0, (t - minT) / span))
            : idx / (n - 1);
      const count = seg.count;
      const r = count <= 1 ? 5 : count <= 3 ? 7 : 9;
      return {
        emotionId: seg.emotionId,
        yValue: emotionYValue(seg.emotionId),
        xRatio,
        r,
        label: formatEntryTime(seg.startCreatedAt),
      };
    });
    return { kind: n === 1 ? 'single' : n === 2 ? 'two' : 'multi', points };
  }, [emotionSegments]);

  const selectedSegment = useMemo(() => {
    if (selectedSegmentIndex == null) return null;
    const idx = Number(selectedSegmentIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= emotionSegments.length) return null;
    return emotionSegments[idx] ?? null;
  }, [emotionSegments, selectedSegmentIndex]);

  const selectedMemoItems = useMemo(() => {
    if (!selectedSegment) return [];
    const list = selectedSegment.entries || [];
    return list
      .filter((e) => (e?.memo || '').trim().length > 0)
      .map((e) => {
        const parts = splitMemo(e.memo || '');
        const title = (parts.title || '').trim();
        const body = (parts.content || '').trim() || (e.memo || '').trim();
        const firstLine = body.split('\n').map((x) => x.trim()).find(Boolean) || '';
        const titleText =
          title ||
          (firstLine.length > 36 ? `${firstLine.slice(0, 36).trim()}…` : firstLine) ||
          '메모';
        return {
          id: e.id,
          timeText: formatEntryTime(e.createdAt),
          titleText,
        };
      });
  }, [selectedSegment]);

  const changePointText = useMemo(() => {
    if (daySorted.length < 2) return '감정이 크게 바뀌진 않았어요';

    /** @type {number[]} */
    const hours = [];
    for (let i = 1; i < daySorted.length; i += 1) {
      const prev = daySorted[i - 1];
      const cur = daySorted[i];
      if (prev?.emotionId !== cur?.emotionId) {
        hours.push(getEntryTimelineHour(cur));
      }
    }

    const uniq = [...new Set(hours.filter((h) => Number.isFinite(h)))];
    if (uniq.length === 0) return '감정이 크게 바뀌진 않았어요';
    if (uniq.length === 1) return `${uniq[0]}시에 감정이 바뀌었어요`;
    if (uniq.length <= 3) return `${uniq.slice(0, 3).map((h) => `${h}시`).join(', ')}에 감정이 바뀌었어요`;
    return '감정이 여러 번 바뀐 하루예요';
  }, [daySorted]);

  const concentrationText = useMemo(() => {
    if (daySorted.length === 0) return '기록이 아직 없어요';
    if (daySorted.length === 1) {
      const h = getEntryTimelineHour(daySorted[0]);
      if (h >= 6 && h <= 11) return '아침에 기록이 있었어요';
      if (h >= 12 && h <= 17) return '오후에 기록이 있었어요';
      if (h >= 18 && h <= 23) return '저녁에 기록이 있었어요';
      return '하루 중 한 번 기록이 있었어요';
    }

    /** @type {Record<number, number>} */
    const byHour = {};
    for (const e of daySorted) {
      const h = getEntryTimelineHour(e);
      if (!Number.isFinite(h)) continue;
      byHour[h] = (byHour[h] || 0) + 1;
    }

    // Densest 3-hour window (simple + stable).
    const windowSize = 3;
    let bestStart = 0;
    let bestCount = -1;
    for (let start = 0; start <= 24 - windowSize; start += 1) {
      let c = 0;
      for (let h = start; h < start + windowSize; h += 1) c += byHour[h] || 0;
      if (c > bestCount) {
        bestCount = c;
        bestStart = start;
      }
    }

    if (bestCount >= 3) {
      const end = bestStart + windowSize - 1;
      return `${bestStart}시~${end}시에 기록이 집중되어 있어요`;
    }

    // Fallback broad label (morning / afternoon / evening) using bucket counts.
    const countIn = (from, to) => {
      let c = 0;
      for (let h = from; h <= to; h += 1) c += byHour[h] || 0;
      return c;
    };
    const morning = countIn(6, 11);
    const afternoon = countIn(12, 17);
    const evening = countIn(18, 23);

    const max = Math.max(morning, afternoon, evening);
    if (max <= 1) return '하루 중 띄엄띄엄 기록됐어요';
    if (evening === max) return '저녁에 기록이 많았어요';
    if (afternoon === max) return '오후에 기록이 많았어요';
    return '아침에 기록이 많았어요';
  }, [daySorted]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: 28 + Math.max(insets.bottom, 12) }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>하루 요약</Text>
      <Text style={styles.dateLine}>{dateTitle}</Text>

      {!analysis ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>기록이 없어요</Text>
          <Text style={styles.emptySub}>이 날 남긴 감정이 없어 분석할 수 없어요.</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>감정 흐름</Text>
            <EmotionFlowGraph
              flowGraph={segmentFlowGraph}
              selectedIndex={selectedSegmentIndex}
              onSelectIndex={(idx) => {
                setSelectedSegmentIndex((cur) => (cur === idx ? null : idx));
              }}
            />
          </View>

          <View style={styles.insightSection}>
            <Text style={styles.insightLabel}>감정 변화</Text>
            <Text style={styles.insightText}>{changePointText}</Text>
          </View>

          <View style={styles.insightSection}>
            <Text style={styles.insightLabel}>기록이 몰린 시간</Text>
            <Text style={styles.insightText}>{concentrationText}</Text>
          </View>

          <View style={styles.segmentDetailSection}>
            <Text style={styles.insightLabel}>이때 남긴 기록</Text>

            {!selectedSegment ? (
              <Text style={styles.segmentDetailHint}>
                그래프의 점을 눌러 그때의 기록을 볼 수 있어요
              </Text>
            ) : selectedMemoItems.length === 0 ? (
              <Text style={styles.segmentDetailHint}>이 구간에는 남긴 메모가 없어요</Text>
            ) : (
              selectedMemoItems.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.segmentMemoItem, idx === 0 ? { borderTopWidth: 0 } : null]}
                >
                  <Text style={styles.segmentMemoTime}>{item.timeText}</Text>
                  <Text style={styles.segmentMemoTitle}>{item.titleText}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: notebook.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: notebook.inkLight,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dateLine: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    color: notebook.ink,
    letterSpacing: -0.3,
    marginBottom: 18,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    lineHeight: 21,
    color: notebook.inkMuted,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: notebook.inkMuted,
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  insightSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: notebook.inkMuted,
    marginBottom: 10,
  },
  insightText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: notebook.ink,
  },
  segmentDetailSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  segmentDetailHint: {
    fontSize: 14,
    lineHeight: 22,
    color: notebook.inkLight,
  },
  segmentMemoItem: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
  },
  segmentMemoTime: {
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkLight,
    marginBottom: 4,
  },
  segmentMemoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: notebook.ink,
    lineHeight: 22,
  },
});

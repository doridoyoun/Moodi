import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmotionFlowGraph from '../components/analysis/EmotionFlowGraph';
import { useMood } from '../src/context/MoodContext';
import { notebook } from '../constants/theme';
import { computeDailyAnalysis, emotionYValue, normEmotionId } from '../utils/dailyAnalysis';
import { formatDateKeyForDisplay, getEntriesForDate, getEntryTimelineHour } from '../storage/timelineStateStorage';
import { formatEntryTime, paletteFor, splitMemo } from '../utils/timelineEntryFormat';

const MAX_SEGMENT_SIZE = 6;

function normalizeImageUri(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  if (/^(https?:|file:|content:|ph:|assets-library:|blob:|data:)/i.test(s)) return s;
  if (/^[a-zA-Z]:\\/.test(s)) return s;
  return null;
}

export default function DailyAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { entries, selectedDate, setRepresentativeOverrideForDate } = useMood();
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(null);
  const [previewUri, setPreviewUri] = useState(null);
  const [oneLinePickerVisible, setOneLinePickerVisible] = useState(false);
  const [readOnlyEntryId, setReadOnlyEntryId] = useState(null);
  const [selectedEntryId, setSelectedEntryId] = useState(null);

  const analysis = useMemo(
    () => computeDailyAnalysis(entries, selectedDate),
    [entries, selectedDate],
  );

  const oneLineMemo =
    analysis?.representativeMemo && typeof analysis.representativeMemo === 'string'
      ? analysis.representativeMemo.trim()
      : '';
  const oneLineSource = analysis?.representativeMemoSource ?? null;
  const oneLineTimeText =
    oneLineSource?.createdAt && typeof oneLineSource.createdAt === 'string'
      ? formatEntryTime(oneLineSource.createdAt)
      : '';

  const oneLineTitle = useMemo(() => {
    if (!oneLineMemo) return '';
    const parts = splitMemo(oneLineMemo);
    const title = (parts.title || '').trim();
    const body = (parts.content || '').trim() || oneLineMemo;
    const firstLine = body.split('\n').map((x) => x.trim()).find(Boolean) || '';
    return title || firstLine;
  }, [oneLineMemo]);

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
    setSelectedEntryId(null);
  }, [selectedDate]);

  const emotionBarEntries = useMemo(() => {
    return daySorted.map((e) => {
      const memoRaw = typeof e?.memo === 'string' ? e.memo.trim() : '';
      const parts = splitMemo(memoRaw);
      const title = (parts.title || '').trim();
      const content = (parts.content || '').trim();
      const firstLine = content.split('\n').map((x) => x.trim()).find(Boolean) || '';
      const hasMemo = Boolean(title || firstLine);
      const pal = paletteFor(normEmotionId(e?.emotionId));
      return {
        id: e?.id ?? `${e?.createdAt || ''}-${e?.emotionId || ''}`,
        entryId: e?.id ?? null,
        timeText: formatEntryTime(e?.createdAt),
        hasMemo,
        color: pal.border,
      };
    });
  }, [daySorted]);

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
        const imageUri = normalizeImageUri(e?.imageUri);
        const hasPhoto = Boolean(imageUri);
        return {
          id: e.id,
          timeText: formatEntryTime(e.createdAt),
          titleText,
          hasPhoto,
          imageUri,
        };
      });
  }, [selectedSegment]);

  const dayListItems = useMemo(() => {
    const rep = analysis?.representativeMemoSource ?? null;
    const repCreatedAt = typeof rep?.createdAt === 'string' ? rep.createdAt : null;
    const repEmotionId = rep?.emotionId ? normEmotionId(rep.emotionId) : null;

    return daySorted.map((e) => {
      const parts = splitMemo(e?.memo || '');
      const title = (parts.title || '').trim();
      const content = (parts.content || '').trim();
      const firstLine = content.split('\n').map((x) => x.trim()).find(Boolean) || '';
      const hasMemo = Boolean(title || firstLine);
      const memoPreview = title || firstLine || '';
      const imageUri = normalizeImageUri(e?.imageUri);
      const hasPhoto = Boolean(imageUri);

      const isRepresentative =
        repCreatedAt &&
        typeof e?.createdAt === 'string' &&
        e.createdAt === repCreatedAt &&
        repEmotionId &&
        normEmotionId(e?.emotionId) === repEmotionId;

      return {
        id: e?.id ?? `${e?.createdAt || ''}-${e?.emotionId || ''}`,
        entryId: e?.id ?? null,
        createdAt: typeof e?.createdAt === 'string' ? e.createdAt : '',
        timeText: formatEntryTime(e?.createdAt),
        emotionId: normEmotionId(e?.emotionId),
        hasMemo,
        memoPreview,
        isRepresentative,
        hasPhoto,
        imageUri,
      };
    });
  }, [analysis, daySorted]);

  const dayListMemoItems = useMemo(() => dayListItems.filter((x) => x.hasMemo), [dayListItems]);
  const dayListEmotionOnlyCount = useMemo(
    () => dayListItems.reduce((sum, x) => sum + (x.hasMemo ? 0 : 1), 0),
    [dayListItems],
  );

  const readOnlyEntry = useMemo(() => {
    if (!readOnlyEntryId) return null;
    return daySorted.find((e) => e?.id === readOnlyEntryId) ?? null;
  }, [daySorted, readOnlyEntryId]);

  const readOnlyParts = useMemo(() => {
    const memo = typeof readOnlyEntry?.memo === 'string' ? readOnlyEntry.memo : '';
    const parts = splitMemo(memo);
    return {
      title: (parts.title || '').trim(),
      content: (parts.content || '').trim(),
    };
  }, [readOnlyEntry]);

  const readOnlyPhotoUri = useMemo(() => normalizeImageUri(readOnlyEntry?.imageUri), [readOnlyEntry?.imageUri]);

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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.barRow}
            >
              {emotionBarEntries.map((b) => {
                const isSelected = Boolean(b.entryId) && b.entryId === selectedEntryId;
                const opacity = selectedEntryId ? (isSelected ? 1 : 0.5) : 1;
                const w = b.hasMemo ? 10 : 6;
                const h = isSelected ? 56 : 46;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      if (b.entryId) setSelectedEntryId(b.entryId);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`${b.timeText} 감정 선택`}
                    style={({ pressed }) => [styles.barItem, pressed && { opacity: 0.85 }]}
                  >
                    {isSelected ? <Text style={styles.barTimeLabel}>{b.timeText}</Text> : null}
                    <View
                      style={[
                        styles.bar,
                        {
                          width: w,
                          height: h,
                          backgroundColor: b.color,
                          opacity,
                        },
                        isSelected && styles.barSelected,
                      ]}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
            <EmotionFlowGraph
              flowGraph={segmentFlowGraph}
              selectedIndex={selectedSegmentIndex}
              onSelectIndex={(idx) => {
                setSelectedSegmentIndex((cur) => (cur === idx ? null : idx));
              }}
            />
          </View>

          <Pressable
            onPress={() => setOneLinePickerVisible(true)}
            style={({ pressed }) => [styles.oneLineSection, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel="오늘의 한 줄 선택"
          >
            <View style={styles.oneLineHeaderRow}>
              <Text style={styles.insightLabel}>오늘의 한 줄</Text>
              {oneLineTimeText ? <Text style={styles.oneLineTime}>{oneLineTimeText}</Text> : null}
            </View>
            <Text style={styles.oneLineText}>
              {oneLineTitle || '오늘의 한 줄을 선택해보세요'}
            </Text>
          </Pressable>

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
                  <View style={styles.segmentMemoTitleRow}>
                    <Text style={styles.segmentMemoTitle}>{item.titleText}</Text>
                    {item.hasPhoto ? (
                      <Pressable
                        onPress={() => {
                          if (item.imageUri) setPreviewUri(item.imageUri);
                        }}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="사진 미리보기"
                        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                      >
                        <Text style={styles.photoIndicator}>📷</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.dayListSection}>
            <Text style={styles.sectionTitle}>오늘 기록</Text>

            {dayListMemoItems.map((item, idx) => {
              const isLast =
                idx === dayListMemoItems.length - 1 && dayListEmotionOnlyCount === 0;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (item.entryId) setReadOnlyEntryId(item.entryId);
                  }}
                  style={({ pressed }) => [
                    styles.dayListItem,
                    isLast ? { marginBottom: 0 } : null,
                    pressed && { opacity: 0.92 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.timeText} 메모 열기`}
                >
                  <Text style={styles.dayListTime}>{item.timeText}</Text>

                  <Text
                    style={[
                      styles.dayListText,
                      item.isRepresentative ? styles.dayListTextRep : null,
                    ]}
                  >
                    {item.memoPreview}
                  </Text>
                </Pressable>
              );
            })}

            {dayListEmotionOnlyCount > 0 ? (
              <View style={[styles.dayListItem, { marginBottom: 0 }]}>
                <Text style={styles.dayListTime} />
                <Text style={styles.dayListEmotionOnlyText}>
                  감정만 기록된 순간 {dayListEmotionOnlyCount}개
                </Text>
              </View>
            ) : null}
          </View>
        </>
      )}

      <Modal
        visible={previewUri != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <View style={styles.previewRoot}>
          <Pressable
            style={styles.previewBackdrop}
            onPress={() => setPreviewUri(null)}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          />
          <View style={styles.previewCenter} pointerEvents="box-none">
            <Pressable
              onPress={() => setPreviewUri(null)}
              style={({ pressed }) => [styles.previewImageWrap, pressed && { opacity: 0.98 }]}
              accessibilityRole="button"
              accessibilityLabel="사진 닫기"
            >
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                  onError={() => setPreviewUri(null)}
                />
              ) : null}
            </Pressable>
          </View>
        </View>
      </Modal>

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

      <Modal
        visible={readOnlyEntry != null}
        transparent
        animationType="fade"
        onRequestClose={() => setReadOnlyEntryId(null)}
      >
        <View style={styles.readOnlyRoot}>
          <Pressable
            style={styles.readOnlyBackdrop}
            onPress={() => setReadOnlyEntryId(null)}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          />
          <View style={styles.readOnlyCard} pointerEvents="box-none">
            <View style={styles.readOnlyHeader}>
              <View style={styles.readOnlyHeaderLeft}>
                <Text style={styles.readOnlyEmotion}>{paletteFor(normEmotionId(readOnlyEntry?.emotionId)).label}</Text>
                <Text style={styles.readOnlyTime}>{formatEntryTime(readOnlyEntry?.createdAt)}</Text>
              </View>
              <Pressable
                onPress={() => setReadOnlyEntryId(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="닫기"
                style={({ pressed }) => [styles.readOnlyClose, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.readOnlyCloseText}>닫기</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.readOnlyScrollContent}>
              {readOnlyParts.title ? <Text style={styles.readOnlyTitle}>{readOnlyParts.title}</Text> : null}
              {readOnlyParts.content ? (
                <Text style={styles.readOnlyBody}>{readOnlyParts.content}</Text>
              ) : !readOnlyParts.title ? (
                <Text style={styles.readOnlyMuted}>(내용 없음)</Text>
              ) : null}

              {readOnlyPhotoUri ? (
                <Image
                  source={{ uri: readOnlyPhotoUri }}
                  style={styles.readOnlyPhoto}
                  resizeMode="cover"
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  barRow: {
    paddingTop: 10,
    paddingBottom: 14,
    alignItems: 'flex-end',
    gap: 10,
  },
  barItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 16,
  },
  bar: {
    borderRadius: 999,
  },
  barSelected: {
    transform: [{ scaleX: 1.06 }],
    borderWidth: 2,
    borderColor: 'rgba(15, 23, 42, 0.18)',
  },
  barTimeLabel: {
    position: 'absolute',
    top: 0,
    left: -12,
    right: -12,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: notebook.inkMuted,
    fontVariant: ['tabular-nums'],
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
  segmentMemoTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dayListSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: notebook.inkMuted,
    marginBottom: 12,
  },
  dayListItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayListTime: {
    width: 48,
    fontSize: 12,
    color: notebook.inkLight,
    paddingTop: 2,
  },
  dayListContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emotionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 8,
  },
  dayListTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dayListTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  },
  repBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: notebook.gridLine,
    marginRight: 6,
    marginTop: 2,
    marginBottom: 2,
  },
  repBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: notebook.inkMuted,
  },
  dayListText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: notebook.ink,
  },
  dayListTextRep: {
    fontWeight: '700',
    color: '#111827',
  },
  photoIndicator: {
    fontSize: 12,
    color: notebook.inkLight,
    paddingTop: 1,
  },
  dayListEmotionOnlyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: notebook.inkMuted,
  },
  oneLineSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  oneLineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  oneLineTime: {
    fontSize: 12,
    color: notebook.inkLight,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  oneLineText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: notebook.ink,
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
  previewRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  previewImageWrap: {
    width: '100%',
    maxWidth: 520,
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,20,0.3)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  readOnlyRoot: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  readOnlyBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  readOnlyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
    maxHeight: '84%',
  },
  readOnlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: notebook.gridLine,
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  readOnlyHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  readOnlyEmotion: {
    fontSize: 16,
    fontWeight: '800',
    color: notebook.ink,
    letterSpacing: -0.2,
  },
  readOnlyTime: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkLight,
    fontVariant: ['tabular-nums'],
  },
  readOnlyClose: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
    backgroundColor: notebook.bg,
  },
  readOnlyCloseText: {
    fontSize: 12,
    fontWeight: '800',
    color: notebook.inkMuted,
  },
  readOnlyScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  readOnlyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: notebook.ink,
    lineHeight: 28,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  readOnlyBody: {
    fontSize: 15,
    lineHeight: 24,
    color: notebook.ink,
  },
  readOnlyMuted: {
    fontSize: 14,
    color: notebook.inkLight,
    fontStyle: 'italic',
  },
  readOnlyPhoto: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    marginTop: 14,
    backgroundColor: notebook.bg,
  },
});

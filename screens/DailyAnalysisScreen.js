import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMood } from '../src/context/MoodContext';
import { notebook } from '../constants/theme';
import { computeDailyAnalysis, normEmotionId } from '../utils/dailyAnalysis';
import { formatDateKeyForDisplay, getEntriesForDate, getEntryTimelineHour } from '../storage/timelineStateStorage';
import { formatEntryDisplayTime, paletteFor, splitMemo } from '../utils/timelineEntryFormat';

function normalizeImageUri(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  return s;
}

function emotionRhythmOffset(emotionId) {
  switch (emotionId) {
    case 'happy':
      return 0;
    case 'flutter':
      return 20;
    case 'calm':
      return 40;
    case 'gloom':
      return 60;
    case 'annoyed':
      return 80;
    default:
      return 40;
  }
}

export default function DailyAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { entries, selectedDate } = useMood();
  const [previewUri, setPreviewUri] = useState(null);
  const [readOnlyEntryId, setReadOnlyEntryId] = useState(null);
  const [readOnlyEntrySnapshot, setReadOnlyEntrySnapshot] = useState(null);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const readOnlySnapshotClearTimerRef = useRef(null);

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
    () =>
      [...dayEntries].sort((a, b) => {
        const ha = getEntryTimelineHour(a);
        const hb = getEntryTimelineHour(b);
        if (ha !== hb) return ha - hb;
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      }),
    [dayEntries],
  );

  useEffect(() => {
    setSelectedEntryId(null);
  }, [selectedDate]);

  useEffect(() => {
    return () => {
      if (readOnlySnapshotClearTimerRef.current) {
        clearTimeout(readOnlySnapshotClearTimerRef.current);
        readOnlySnapshotClearTimerRef.current = null;
      }
    };
  }, []);

  const emotionFlowTimelineItems = useMemo(() => {
    return daySorted.map((e) => {
      const memoRaw = typeof e?.memo === 'string' ? e.memo.trim() : '';
      const parts = splitMemo(memoRaw);
      const title = (parts.title || '').trim();
      const content = (parts.content || '').trim();
      const firstLine = content.split('\n').map((x) => x.trim()).find(Boolean) || '';
      const hasMemo = Boolean(title || firstLine);
      const titleText = title || firstLine || '';
      const emotionId = normEmotionId(e?.emotionId);
      const pal = paletteFor(emotionId);
      const imageUri = normalizeImageUri(e?.imageUri);
      return {
        id: e?.id ?? `${e?.createdAt || ''}-${e?.emotionId || ''}`,
        entryId: e?.id ?? null,
        timeText: formatEntryDisplayTime(e),
        emotionId,
        hasMemo,
        titleText,
        color: pal.border,
        imageUri,
        hasPhoto: Boolean(imageUri),
      };
    });
  }, [daySorted]);

  const selectedFlowEntry = useMemo(
    () =>
      emotionFlowTimelineItems.find((x) => x.entryId != null && x.entryId === selectedEntryId) ?? null,
    [emotionFlowTimelineItems, selectedEntryId],
  );

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
        timeText: formatEntryDisplayTime(e),
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

  const openReadOnlyEntry = useCallback(
    (entryId) => {
      if (!entryId) return;
      const entry = daySorted.find((e) => e?.id === entryId) ?? null;
      if (!entry) return;
      if (readOnlySnapshotClearTimerRef.current) {
        clearTimeout(readOnlySnapshotClearTimerRef.current);
        readOnlySnapshotClearTimerRef.current = null;
      }
      setReadOnlyEntrySnapshot(entry);
      setReadOnlyEntryId(entryId);
    },
    [daySorted],
  );

  const closeReadOnlyModal = useCallback(() => {
    setReadOnlyEntryId(null);
    if (readOnlySnapshotClearTimerRef.current) {
      clearTimeout(readOnlySnapshotClearTimerRef.current);
    }
    readOnlySnapshotClearTimerRef.current = setTimeout(() => {
      setReadOnlyEntrySnapshot(null);
      readOnlySnapshotClearTimerRef.current = null;
    }, 220);
  }, []);

  const readOnlyEntry = readOnlyEntrySnapshot;

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
    if (daySorted.length < 2) return '감정이 크게 바뀌지 않았어요';

    /** @type {number[]} */
    const hours = [];
    for (let i = 1; i < daySorted.length; i += 1) {
      const prev = daySorted[i - 1];
      const cur = daySorted[i];
      if (prev?.emotionId !== cur?.emotionId) {
        hours.push(getEntryTimelineHour(cur));
      }
    }

    const changeCount = [...new Set(hours.filter((h) => Number.isFinite(h)))].length;
    if (changeCount === 0) return '감정이 크게 바뀌지 않았어요';
    if (changeCount === 1) return '중간에 감정이 달라졌어요';
    return '감정이 여러 번 바뀌었어요';
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
          <Text style={styles.emptyTitle}>아직 기록이 없는 하루예요</Text>
          <Text style={styles.emptySub}>가볍게 감정을 남겨보세요</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>감정 흐름</Text>
            <View style={styles.flowRhythmBox}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flowRhythmContent}
              >
                {emotionFlowTimelineItems.map((item) => {
                  const isSelected = Boolean(item.entryId) && item.entryId === selectedEntryId;
                  const barOpacity = isSelected ? 1 : 0.42;
                  const barW = 16;
                  const barH = 40;
                  const top = emotionRhythmOffset(item.emotionId);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        if (!item.entryId) return;
                        setSelectedEntryId((cur) => (cur === item.entryId ? null : item.entryId));
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel="감정 순간"
                      style={({ pressed }) => [styles.flowRhythmItem, pressed && styles.flowRhythmItemPressed]}
                    >
                      <View style={[styles.flowRhythmBarWrap, { marginTop: top }]}>
                        {item.hasMemo ? <View style={styles.flowRhythmMemoDot} /> : null}
                        <View
                          style={[
                            styles.flowRhythmBar,
                            {
                              width: barW,
                              height: barH,
                              backgroundColor: item.color,
                              opacity: barOpacity,
                            },
                            isSelected ? styles.flowRhythmBarSelected : null,
                          ]}
                        />
                      </View>
                      {isSelected ? (
                        <Text style={styles.flowRhythmSelectedTime} numberOfLines={1}>
                          {item.timeText}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={styles.segmentDetailSection}>
            <Text style={styles.insightLabel}>이때 남긴 기록</Text>

            {!selectedFlowEntry ? (
              <Text style={styles.segmentDetailHint}>
                감정 흐름에서 순간을 눌러 그때의 기록을 볼 수 있어요
              </Text>
            ) : !selectedFlowEntry.hasMemo ? (
              <Text style={styles.segmentDetailHint}>이 순간엔 따로 남긴 메모는 없어요</Text>
            ) : (
              <View style={[styles.segmentMemoItem, { borderTopWidth: 0, paddingTop: 0 }]}>
                <Text style={styles.segmentMemoTime}>{selectedFlowEntry.timeText}</Text>
                <View style={styles.segmentMemoTitleRow}>
                  <Text style={styles.segmentMemoTitle} numberOfLines={4}>
                    {selectedFlowEntry.titleText}
                  </Text>
                  {selectedFlowEntry.hasPhoto ? (
                    <Pressable
                      onPress={() => {
                        if (selectedFlowEntry.imageUri) setPreviewUri(selectedFlowEntry.imageUri);
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
            )}
          </View>

          <View style={styles.insightSection}>
            <Text style={styles.insightLabel}>감정 변화</Text>
            <Text style={styles.insightText}>{changePointText}</Text>
          </View>

          <View style={styles.dayListSection}>
            <Text style={styles.sectionTitle}>오늘 기록</Text>

            {dayListMemoItems.length === 0 ? (
              <Text style={styles.segmentDetailHint}>이 순간엔 따로 남긴 메모는 없어요</Text>
            ) : (
              dayListMemoItems.map((item, idx) => {
                const emotionPal = paletteFor(item.emotionId);
                const isLastMemoOnly = idx === dayListMemoItems.length - 1;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      if (readOnlyEntryId) return;
                      if (item.entryId) openReadOnlyEntry(item.entryId);
                    }}
                    style={({ pressed }) => [
                      styles.dayListItem,
                      isLastMemoOnly ? { marginBottom: 0 } : null,
                      pressed && { opacity: 0.92 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.timeText} 메모 열기`}
                  >
                    <Text style={styles.dayListTime}>{item.timeText}</Text>
                    <View style={styles.dayListContent}>
                      <View style={[styles.emotionDot, { backgroundColor: emotionPal.border }]} />
                      <View style={styles.dayListTextRow}>
                        <Text
                          style={[
                            styles.dayListText,
                            item.isRepresentative ? styles.dayListTextRep : null,
                          ]}
                          numberOfLines={3}
                        >
                          {item.memoPreview}
                        </Text>
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
                  </Pressable>
                );
              })
            )}
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
                  onError={() => {
                    console.log('IMAGE ERROR:', previewUri);
                    setPreviewUri(null);
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={readOnlyEntrySnapshot != null}
        transparent
        animationType="fade"
        onRequestClose={closeReadOnlyModal}
        onDismiss={() => setReadOnlyEntrySnapshot(null)}
      >
        {readOnlyEntrySnapshot ? (
          <View style={styles.readOnlyRoot}>
            <Pressable
              style={styles.readOnlyBackdrop}
              onPress={closeReadOnlyModal}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            />
            <View style={styles.readOnlyCard}>
              <View style={styles.readOnlyHeader}>
                <View style={styles.readOnlyHeaderLeft}>
                  <Text style={styles.readOnlyEmotion}>
                    {paletteFor(normEmotionId(readOnlyEntrySnapshot?.emotionId)).label}
                  </Text>
                  <Text style={styles.readOnlyTime}>{formatEntryDisplayTime(readOnlyEntrySnapshot)}</Text>
                </View>
                <Pressable
                  onPress={closeReadOnlyModal}
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
                    onError={() => console.log('IMAGE ERROR:', readOnlyPhotoUri)}
                  />
                ) : null}
              </ScrollView>
            </View>
          </View>
        ) : null}
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
  flowRhythmBox: {
    marginTop: 4,
    height: 160,
  },
  flowRhythmContent: {
    alignItems: 'flex-start',
    paddingLeft: 16,
    paddingRight: 6,
    paddingBottom: 20,
  },
  flowRhythmItem: {
    height: 160,
    width: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: 0,
  },
  flowRhythmItemPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.03)',
    borderRadius: 10,
  },
  flowRhythmBarWrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  flowRhythmBar: {
    borderRadius: 999,
  },
  flowRhythmBarSelected: {
    borderWidth: 2,
    borderColor: 'rgba(79, 70, 229, 0.5)',
  },
  flowRhythmMemoDot: {
    position: 'absolute',
    top: -9,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: notebook.inkMuted,
  },
  flowRhythmSelectedTime: {
    position: 'absolute',
    bottom: 0,
    width: 48,
    left: '50%',
    marginLeft: -24,
    fontSize: 11,
    fontWeight: '700',
    color: notebook.inkMuted,
    textAlign: 'center',
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
    fontWeight: '800',
    color: '#0f172a',
  },
  photoIndicator: {
    fontSize: 12,
    color: notebook.inkLight,
    paddingTop: 1,
  },
  dayListEmotionOnlySummaryPressable: {
    alignItems: 'stretch',
    paddingVertical: 6,
  },
  dayListEmotionOnlySummaryText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: notebook.inkMuted,
    textAlign: 'left',
  },
  dayListEmotionOnlyRow: {
    marginBottom: 6,
    paddingVertical: 2,
  },
  dayListEmotionOnlyGridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dayListEmotionOnlyTimeSpacer: {
    width: 48,
  },
  dayListEmotionOnlyDotSpacer: {
    width: 8,
    marginRight: 8,
  },
  dayListEmotionOnlyTextCol: {
    flex: 1,
    minWidth: 0,
  },
  dayListEmotionOnlyTime: {
    width: 48,
    fontSize: 11,
    fontWeight: '500',
    color: notebook.inkLight,
    fontVariant: ['tabular-nums'],
  },
  dayListEmotionOnlyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkMuted,
    textAlign: 'left',
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

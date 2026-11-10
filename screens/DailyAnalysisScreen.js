import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useMood } from '../src/context/MoodContext';
import { notebook } from '../constants/theme';
import { computeDailyAnalysis, normEmotionId } from '../utils/dailyAnalysis';
import { formatDateKeyForDisplay, getEntriesForDate, getEntryTimelineHour } from '../storage/timelineStateStorage';
import { formatEntryDisplayTime, paletteFor, splitMemo } from '../utils/timelineEntryFormat';

const FLOW_ITEM_WIDTH = 24;

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
      return 16;
    case 'calm':
      return 32;
    case 'gloom':
      return 48;
    case 'annoyed':
      return 64;
    default:
      return 32;
  }
}

export default function DailyAnalysisScreen() {
  const { height } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [recordTop, setRecordTop] = useState(0);
  const [recordViewport, setRecordViewport] = useState(0);
  const [recordContentHeight, setRecordContentHeight] = useState(0);
  const [recordScrollY, setRecordScrollY] = useState(0);
  const recordScrollRef = useRef(null);
  const recordRowRefs = useRef(new Map());
  const graphScrollRef = useRef(null);
  const graphViewportWidth = useRef(0);
  const { entries, selectedDate } = useMood();
  const recordOffsets = useMemo(() => new Map(), [selectedDate]);
  const [selectedGraphId, setSelectedGraphId] = useState(null);
  const [failedPhotoUri, setFailedPhotoUri] = useState(null);
  const [readOnlyEntryId, setReadOnlyEntryId] = useState(null);
  const [readOnlyEntrySnapshot, setReadOnlyEntrySnapshot] = useState(null);
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
    setSelectedGraphId(null);
    setRecordScrollY(0);
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
      const emotionId = normEmotionId(e?.emotionId);
      const pal = paletteFor(emotionId);
      return {
        id: e?.id ?? `${e?.createdAt || ''}-${e?.emotionId || ''}`,
        timeText: formatEntryDisplayTime(e),
        emotionId,
        color: pal.border,
      };
    });
  }, [daySorted]);

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

  const memoEntryIds = useMemo(
    () => new Set(dayListItems.filter((item) => item.hasMemo).map((item) => item.id)),
    [dayListItems],
  );

  const scrollToRecord = (id) => {
    const scrollView = recordScrollRef.current;
    if (!scrollView) return;

    let y = recordOffsets.get(id);
    if (Platform.OS === 'web') {
      const viewport = scrollView.getScrollableNode?.();
      const row = recordRowRefs.current.get(id);
      if (viewport?.getBoundingClientRect && row?.getBoundingClientRect) {
        y = viewport.scrollTop + row.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
      }
    }

    if (y != null) scrollView.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  const scrollToGraphItem = (index) => {
    if (index < 0) return;
    const itemCenter = (index + 0.5) * FLOW_ITEM_WIDTH;
    const x = Math.max(0, itemCenter - graphViewportWidth.current / 2);
    graphScrollRef.current?.scrollTo({ x, animated: true });
  };

  const openReadOnlyEntry = useCallback(
    (entryId) => {
      if (!entryId) return;
      const entry = daySorted.find((e) => e?.id === entryId) ?? null;
      if (!entry) return;
      if (readOnlySnapshotClearTimerRef.current) {
        clearTimeout(readOnlySnapshotClearTimerRef.current);
        readOnlySnapshotClearTimerRef.current = null;
      }
      setFailedPhotoUri(null);
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

  const recordListHeight = viewportHeight && recordTop ? Math.max(120, viewportHeight - recordTop - 38) : height * 0.32;

  const recordOverflow = recordContentHeight - recordViewport;
  const showRecordScrollbar = recordViewport > 0 && recordOverflow > 1;
  const thumbHeight = showRecordScrollbar
    ? Math.min(recordViewport, Math.max(16, recordViewport ** 2 / recordContentHeight))
    : 0;
  const thumbTop = showRecordScrollbar
    ? (recordViewport - thumbHeight) * Math.max(0, Math.min(1, recordScrollY / recordOverflow))
    : 0;

  const readOnlyPhotoUri = useMemo(() => normalizeImageUri(readOnlyEntry?.imageUri), [readOnlyEntry?.imageUri]);

  return (
    <ScrollView
      style={styles.scroll}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
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
                key={selectedDate}
                ref={graphScrollRef}
                onLayout={(event) => {
                  graphViewportWidth.current = event.nativeEvent.layout.width;
                }}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flowRhythmContent}
              >
                {emotionFlowTimelineItems.map((item, index) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedGraphId === item.id }}
                    onPress={() => {
                      setSelectedGraphId(item.id);
                      scrollToGraphItem(index);
                      scrollToRecord(item.id);
                    }}
                    accessibilityLabel={`${item.timeText} ${paletteFor(item.emotionId).label}${memoEntryIds.has(item.id) ? ", 메모 있음" : ""}`}
                    style={styles.flowRhythmItem}
                  >
                    <View style={{ marginTop: emotionRhythmOffset(item.emotionId) }}>
                      {memoEntryIds.has(item.id) ? <View style={styles.flowMemoDot} /> : null}
                      <View
                        style={[
                          styles.flowRhythmBar,
                          selectedGraphId === item.id && { borderWidth: 2, borderColor: paletteFor(item.emotionId).ink },
                          { backgroundColor: item.color },
                        ]}
                      />
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View
            style={styles.dayListSection}
            onLayout={(event) => setRecordTop(event.nativeEvent.layout.y)}
          >
            <ScrollView
              key={selectedDate}
              ref={recordScrollRef}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              onLayout={(event) => setRecordViewport(event.nativeEvent.layout.height)}
              onContentSizeChange={(_, contentHeight) => setRecordContentHeight(contentHeight)}
              onScroll={(event) => setRecordScrollY(event.nativeEvent.contentOffset.y)}
              scrollEventThrottle={16}
              accessibilityLabel="오늘 기록"
              style={{ maxHeight: recordListHeight }}
              contentContainerStyle={styles.dayListPadding}
            >

              {dayListItems.length === 0 ? (
                <Text style={styles.segmentDetailHint}>이날 남긴 메모가 없어요</Text>
              ) : (
                dayListItems.map((item, idx) => {
                  const emotionPal = paletteFor(item.emotionId);
                  const isLastItem = idx === dayListItems.length - 1;
                  return (
                    <Pressable
                      key={item.id}
                      ref={(row) => {
                        if (row) recordRowRefs.current.set(item.id, row);
                        else recordRowRefs.current.delete(item.id);
                      }}
                      onLayout={(event) => {
                        recordOffsets.set(item.id, event.nativeEvent.layout.y);
                      }}
                      onPress={() => {
                        if (readOnlyEntryId) return;
                        setSelectedGraphId(item.id);
                        const index = emotionFlowTimelineItems.findIndex((entry) => entry.id === item.id);
                        scrollToGraphItem(index);
                        if (item.entryId) openReadOnlyEntry(item.entryId);
                      }}
                      style={({ pressed }) => [
                        styles.dayListItem,
                        selectedGraphId === item.id && styles.dayListItemSelected,
                        isLastItem ? { marginBottom: 0 } : null,
                        pressed && { opacity: 0.92 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.timeText} 기록 열기`}
                    >
                      <Text style={styles.dayListTime}>{item.timeText}</Text>
                      <View style={styles.dayListContent}>
                        <View style={[styles.emotionDot, { backgroundColor: emotionPal.border }]} />
                        <View style={styles.dayListTextRow}>
                          <Text
                            style={[
                              styles.dayListText,
                              item.isRepresentative && styles.dayListTextRep,
                              !item.hasMemo && !item.hasPhoto && styles.dayListEmptyText,
                            ]}
                            numberOfLines={3}
                          >
                            {item.memoPreview || (item.hasPhoto ? "사진 기록" : "남긴 메모가 없어요")}
                          </Text>
                          {item.hasPhoto ? <Text style={styles.photoIndicator}>📷</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            {showRecordScrollbar ? (
              <View pointerEvents="none" style={styles.recordScrollbar}>
                <View style={[styles.recordScrollbarThumb, { height: thumbHeight, top: thumbTop }]} />
              </View>
            ) : null}
          </View>
        </>
      )}

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
                <Pressable
                  onPress={closeReadOnlyModal}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                  style={({ pressed }) => [styles.readOnlyClose, pressed && { opacity: 0.75 }]}
                >
                  <X size={20} color={notebook.inkMuted} strokeWidth={2} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.readOnlyScrollContent, !readOnlyParts.title && styles.readOnlyUntitled]}>
                {readOnlyParts.title ? <Text style={styles.readOnlyTitle}>{readOnlyParts.title}</Text> : null}
                {readOnlyParts.content ? (
                  <Text style={styles.readOnlyBody}>{readOnlyParts.content}</Text>
                ) : !readOnlyParts.title ? (
                  <Text style={styles.readOnlyMuted}>(내용 없음)</Text>
                ) : null}

                {readOnlyPhotoUri && failedPhotoUri !== readOnlyPhotoUri ? (
                  <Image
                    source={{ uri: readOnlyPhotoUri }}
                    style={styles.readOnlyPhoto}
                    resizeMode="contain"
                    onError={() => setFailedPhotoUri(readOnlyPhotoUri)}
                  />
                ) : readOnlyPhotoUri ? (
                  <Text style={styles.readOnlyMuted}>사진을 불러올 수 없어요</Text>
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
    paddingTop: 0,
    paddingBottom: 12,
  },
  dateLine: {
    fontSize: 22,
    fontWeight: '800',
    color: notebook.ink,
    letterSpacing: -0.3,
    marginBottom: 12,
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
    paddingBottom: 10,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  flowRhythmBox: {
    marginTop: 4,
    height: 106,
  },
  flowRhythmContent: {
    alignItems: 'flex-start',
    paddingRight: 6,
    paddingTop: 10,
  },
  flowRhythmItem: {
    height: 94,
    width: FLOW_ITEM_WIDTH,
    position: 'relative',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginRight: 0,
  },
  flowMemoDot: {
    position: 'absolute',
    alignSelf: 'center',
    top: -8,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: notebook.inkMuted,
  },
  flowRhythmBar: {
    opacity: 0.65,
    width: 16,
    height: 30,
    borderRadius: 999,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: notebook.inkMuted,
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  segmentDetailHint: {
    fontSize: 14,
    lineHeight: 22,
    color: notebook.inkLight,
  },
  dayListSection: {
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  recordScrollbar: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    right: 5,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  recordScrollbarThumb: {
    position: 'absolute',
    width: '100%',
    borderRadius: 2,
    backgroundColor: notebook.inkLight,
  },
  dayListPadding: {
    paddingHorizontal: 18,
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
  dayListEmptyText: {
    color: notebook.inkMuted,
    opacity: 0.8,
    fontWeight: '400',
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
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  readOnlyClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyUntitled: {
    paddingTop: 48,
  },
  readOnlyScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  readOnlyTitle: {
    marginRight: 34,
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
  dayListItemSelected: {
    backgroundColor: '#eeedff',
    borderRadius: 8,
  },
  readOnlyPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 14,
    backgroundColor: notebook.bg,
  },
});

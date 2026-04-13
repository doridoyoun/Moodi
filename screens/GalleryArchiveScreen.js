import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, X } from 'lucide-react-native';
import MoodiFourCutReadOnly from '../components/MoodiFourCutReadOnly';
import NotebookLayout from '../components/NotebookLayout';
import { useMood } from '../src/context/MoodContext';
import { notebook } from '../constants/theme';
import { ensureDayGallery } from '../src/domain/mood/galleryDayState';
import { formatDateKeyForDisplay, parseDateKey } from '../storage/timelineStateStorage';

function canvasDateLabelForDateKey(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return '';
  return new Date(p.year, p.monthIndex, p.day).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

/**
 * @param {Record<string, unknown>} galleryByDate
 * @param {{ id: string, imageUri?: string, emotionId?: string }[]} albumItems
 * @returns {{ dateKey: string, summary: string, innerFrameColorKey: string, slots: (object|null)[] }[]}
 */
function buildArchiveEntries(galleryByDate, albumItems) {
  const map = galleryByDate || {};
  const rows = [];
  for (const dateKey of Object.keys(map)) {
    const day = ensureDayGallery(map, dateKey);
    const slots = day.fourSlotIds.map((id) =>
      id ? albumItems.find((a) => a.id === id) ?? null : null,
    );
    const hasPhoto = slots.some((s) => s?.imageUri);
    if (!hasPhoto) continue;
    rows.push({
      dateKey,
      summary: (day.moodiDaySummary || '').trim(),
      innerFrameColorKey: day.innerFrameColorKey,
      slots,
    });
  }
  rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return rows;
}

const LIST_CARD_WIDTH = 124;

export default function GalleryArchiveScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { galleryByDate, albumItems } = useMood();

  const [detailEntry, setDetailEntry] = useState(null);

  const entries = useMemo(
    () => buildArchiveEntries(galleryByDate, albumItems),
    [galleryByDate, albumItems],
  );

  const detailWidth = Math.min(340, windowW - 80);

  const closeDetail = useCallback(() => setDetailEntry(null), []);

  const renderItem = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => setDetailEntry(item)}
        style={({ pressed }) => [styles.archiveCard, pressed && styles.archiveCardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${item.dateKey} Moodi 상세`}
      >
        <MoodiFourCutReadOnly
          slots={item.slots}
          innerFrameColorKey={item.innerFrameColorKey}
          width={LIST_CARD_WIDTH}
          variant="compact"
        />
        <View style={styles.cardText}>
          <Text style={styles.cardDate}>{formatDateKeyForDisplay(item.dateKey, 'ko-KR')}</Text>
          {item.summary ? (
            <Text style={styles.cardSummary} numberOfLines={1} ellipsizeMode="tail">
              {item.summary}
            </Text>
          ) : (
            <Text style={styles.cardSummaryMuted} numberOfLines={1}>
              한 줄 메모 없음
            </Text>
          )}
        </View>
      </Pressable>
    ),
    [],
  );

  const detailDateLabel = detailEntry
    ? formatDateKeyForDisplay(detailEntry.dateKey, 'ko-KR')
    : '';
  const detailCanvasDate = detailEntry ? canvasDateLabelForDateKey(detailEntry.dateKey) : '';

  return (
    <NotebookLayout>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.72 }]}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <ChevronLeft size={24} color={notebook.inkMuted} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>보관함</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.dateKey}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <Text style={styles.emptyText}>사진이 있는 Moodi만 여기 모여요</Text>
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={detailEntry != null}
        animationType="fade"
        transparent
        onRequestClose={closeDetail}
      >
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailDim} onPress={closeDetail} accessibilityLabel="닫기" />
          <View style={styles.detailCenter} pointerEvents="box-none">
            <View
              style={[
                styles.detailSheet,
                {
                  paddingBottom: insets.bottom + 20,
                  paddingTop: Math.max(insets.top, 12),
                },
              ]}
            >
              <View style={styles.detailHeader}>
                <Text style={styles.detailDateHeading}>{detailDateLabel}</Text>
                <Pressable
                  onPress={closeDetail}
                  hitSlop={12}
                  style={({ pressed }) => [styles.detailClose, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                >
                  <X size={24} color={notebook.inkMuted} strokeWidth={2} />
                </Pressable>
              </View>

              {detailEntry ? (
                <>
                  <MoodiFourCutReadOnly
                    slots={detailEntry.slots}
                    innerFrameColorKey={detailEntry.innerFrameColorKey}
                    width={detailWidth}
                    variant="detail"
                    canvasDateText={detailCanvasDate}
                  />
                  {detailEntry.summary ? (
                    <Text style={styles.detailSummary} numberOfLines={3}>
                      {detailEntry.summary}
                    </Text>
                  ) : (
                    <Text style={styles.detailSummaryMuted}>한 줄 메모 없음</Text>
                  )}
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </NotebookLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 6,
    width: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    flexGrow: 1,
  },
  archiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  archiveCardPressed: {
    opacity: 0.92,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '800',
    color: notebook.ink,
    fontVariant: ['tabular-nums'],
  },
  cardSummary: {
    fontSize: 13,
    fontWeight: '500',
    color: notebook.inkMuted,
    lineHeight: 19,
  },
  cardSummaryMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: notebook.inkLight,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
    fontSize: 14,
    color: notebook.inkLight,
    fontWeight: '600',
    lineHeight: 21,
  },
  detailRoot: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  detailDim: {
    ...StyleSheet.absoluteFillObject,
  },
  detailCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  detailSheet: {
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: notebook.bg,
    maxHeight: '92%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  detailDateHeading: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: notebook.ink,
    fontVariant: ['tabular-nums'],
  },
  detailClose: {
    padding: 4,
  },
  detailSummary: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
    color: notebook.inkMuted,
    lineHeight: 23,
    textAlign: 'center',
  },
  detailSummaryMuted: {
    marginTop: 16,
    fontSize: 14,
    color: notebook.inkLight,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

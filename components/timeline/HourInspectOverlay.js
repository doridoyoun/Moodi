import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import EmotionDisplayToken from './EmotionDisplayToken';
import { formatEntryDisplayTime, splitMemo } from '../../utils/timelineEntryFormat';
import { notebook } from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

export default function HourInspectOverlay({
  overlayVisible,
  activeHour,
  overlayMode,
  emotionEntriesChronAsc,
  memoEntriesNewestFirst,
  overlayFade,
  overlaySlide,
  onDismissBackdrop,
  onSelectEntry,
}) {
  const hScrollRef = useRef(null);

  useEffect(() => {
    if (!overlayVisible || overlayMode !== 'emotion' || emotionEntriesChronAsc.length === 0) {
      return;
    }
    const t = requestAnimationFrame(() => {
      hScrollRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(t);
  }, [overlayVisible, overlayMode, activeHour, emotionEntriesChronAsc.length]);

  if (!overlayVisible || activeHour === null || overlayMode === null) {
    return null;
  }

  const heading = `${String(activeHour).padStart(2, '0')}:00`;
  const sub =
    overlayMode === 'emotion'
      ? '이 시간에 남긴 감정'
      : '제목이 있는 메모';

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.dim, { opacity: overlayFade }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismissBackdrop} />
      </Animated.View>
      <View pointerEvents="box-none" style={styles.cardWrap}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: overlayFade,
              transform: [{ translateY: overlaySlide }],
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.heading}>{heading}</Text>
              <Text style={styles.sub}>{sub}</Text>
            </View>
          </View>

          {overlayMode === 'emotion' ? (
            emotionEntriesChronAsc.length === 0 ? (
              <Text style={styles.empty}>감정 기록이 없어요</Text>
            ) : (
              <ScrollView
                ref={hScrollRef}
                horizontal
                showsHorizontalScrollIndicator={emotionEntriesChronAsc.length > 4}
                contentContainerStyle={styles.emotionStripContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => {
                  hScrollRef.current?.scrollToEnd({ animated: false });
                }}
              >
                {emotionEntriesChronAsc.map((entry) => {
                  const timeText = formatEntryDisplayTime(entry);
                  return (
                    <View key={entry.id} style={styles.emotionTokenSlot}>
                      <EmotionDisplayToken
                        emotionId={entry.emotionId}
                        createdAt={entry.createdAt}
                        size="sm"
                        showTime
                        timeText={timeText}
                        onPress={() => onSelectEntry(entry.id)}
                        accessibilityLabel={`${timeText} 감정 기록`}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            )
          ) : memoEntriesNewestFirst.length === 0 ? (
            <Text style={styles.empty}>제목이 있는 메모가 없어요</Text>
          ) : (
            <ScrollView
              style={styles.memoList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {memoEntriesNewestFirst.map((entry, index) => {
                const { title } = splitMemo(entry.memo);
                const titleLine = (title || '').trim();
                const imageUri = typeof entry?.imageUri === 'string' ? entry.imageUri.trim() : '';
                const hasPhoto = Boolean(imageUri);
                const isLast = index === memoEntriesNewestFirst.length - 1;
                const timeText = formatEntryDisplayTime(entry);
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => onSelectEntry(entry.id)}
                    style={({ pressed }) => [
                      styles.memoRow,
                      !isLast && styles.memoRowBorder,
                      pressed && styles.memoRowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${titleLine}, ${timeText}`}
                  >
                    <EmotionDisplayToken
                      emotionId={entry.emotionId}
                      createdAt={null}
                      size="sm"
                      showTime={false}
                    />
                    <View style={styles.memoRowMid}>
                      <Text style={styles.memoTime}>{timeText}</Text>
                      <View style={styles.memoTitleRow}>
                        <Text style={styles.memoTitle} numberOfLines={2} ellipsizeMode="tail">
                          {titleLine}
                        </Text>
                        {hasPhoto ? <Text style={styles.memoPhotoIcon}>📷</Text> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  cardWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 51,
    paddingHorizontal: 16,
  },
  card: {
    width: Math.min(SCREEN_W * 0.9, 400),
    maxHeight: SCREEN_H * 0.5,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  cardHeader: {
    marginBottom: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: notebook.ink,
    letterSpacing: 0.15,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkLight,
  },
  emotionStripContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingRight: 4,
  },
  emotionTokenSlot: {
    marginRight: 10,
  },
  memoList: {
    maxHeight: SCREEN_H * 0.34,
  },
  memoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    marginBottom: 4,
    gap: 12,
  },
  memoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: notebook.gridLine,
  },
  memoRowPressed: {
    opacity: 0.85,
  },
  memoRowMid: {
    flex: 1,
    minWidth: 0,
  },
  memoTime: {
    fontSize: 12,
    fontWeight: '700',
    color: notebook.inkMuted,
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  memoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: notebook.ink,
    lineHeight: 21,
  },
  memoTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  memoPhotoIcon: {
    fontSize: 12,
    color: notebook.inkLight,
    paddingTop: 2,
  },
  empty: {
    fontSize: 13,
    color: notebook.inkLight,
    textAlign: 'center',
    paddingVertical: 16,
    lineHeight: 20,
  },
});

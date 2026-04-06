import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CloudRain,
  Flame,
  Heart,
  Leaf,
  Smile,
} from 'lucide-react-native';
import NotebookLayout from '../components/NotebookLayout';
import { moodOrder, moodPalette, notebook } from '../constants/theme';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CHUNKS = 6;

const moodIcons = {
  happy: Smile,
  flutter: Heart,
  calm: Leaf,
  gloom: CloudRain,
  annoyed: Flame,
};

function countToAlpha(count) {
  if (count <= 1) return 0.3;
  if (count === 2) return 0.6;
  return 1.0;
}

function createEmptyChunks() {
  return Array.from({ length: CHUNKS }, () => null);
}

function createInitialHourMap() {
  return Object.fromEntries(HOURS.map((h) => [h, createEmptyChunks()]));
}

export default function TimelineScreen() {
  const [hourChunksMap, setHourChunksMap] = useState(createInitialHourMap);
  const fillOpacityRef = useRef(new Map());

  const getFillOpacity = useCallback((hour, chunkIdx) => {
    const key = `${hour}-${chunkIdx}`;
    if (!fillOpacityRef.current.has(key)) {
      fillOpacityRef.current.set(key, new Animated.Value(0));
    }
    return fillOpacityRef.current.get(key);
  }, []);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const applyEmotionForCurrentHour = useCallback(
    (emotionId) => {
      const hour = new Date().getHours();
      const minute = new Date().getMinutes();
      const chunk = Math.min(CHUNKS - 1, Math.floor(minute / 10));

      setHourChunksMap((prev) => {
        const row = [...(prev[hour] ?? createEmptyChunks())];
        const prevCell = row[chunk];

        let newCell;
        if (!prevCell) {
          newCell = { emotionId, count: 1 };
        } else if (prevCell.emotionId === emotionId) {
          newCell = {
            emotionId,
            count: Math.min(3, prevCell.count + 1),
          };
        } else {
          newCell = { emotionId, count: 1 };
        }

        row[chunk] = newCell;

        const anim = getFillOpacity(hour, chunk);
        const target = countToAlpha(newCell.count);

        if (!prevCell) {
          anim.setValue(0);
          Animated.timing(anim, {
            toValue: target,
            duration: 260,
            useNativeDriver: true,
          }).start();
        } else if (prevCell.emotionId === emotionId) {
          Animated.timing(anim, {
            toValue: target,
            duration: 220,
            useNativeDriver: true,
          }).start();
        } else {
          anim.setValue(0);
          Animated.timing(anim, {
            toValue: target,
            duration: 260,
            useNativeDriver: true,
          }).start();
        }

        return { ...prev, [hour]: row };
      });
    },
    [getFillOpacity],
  );

  return (
    <NotebookLayout
      footer={
        <View style={styles.fabRow}>
          {moodOrder.map((key) => {
            const Icon = moodIcons[key];
            const m = moodPalette[key];
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                onPress={() => applyEmotionForCurrentHour(key)}
                style={({ pressed }) => [
                  styles.fab,
                  { backgroundColor: m.bg, borderColor: m.border },
                  pressed && { opacity: 0.85 },
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
        <Text style={styles.pageTitle}>⭐ Today's Mood Timeline</Text>
        <Text style={styles.date}>{dateLabel}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        {HOURS.map((hour) => {
          const row = hourChunksMap[hour] ?? createEmptyChunks();
          return (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourLabel}>
                {String(hour).padStart(2, '0')}:00
              </Text>
              <View style={styles.chunkRow}>
                {row.map((cell, chunkIdx) => (
                  <ChunkCell
                    key={chunkIdx}
                    cell={cell}
                    fillOpacity={getFillOpacity(hour, chunkIdx)}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </NotebookLayout>
  );
}

function ChunkCell({ cell, fillOpacity }) {
  const pal = cell ? moodPalette[cell.emotionId] : null;
  const Icon = cell ? moodIcons[cell.emotionId] : null;

  return (
    <View style={styles.chunk}>
      {cell && pal && Icon ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 8,
                backgroundColor: pal.bg,
                opacity: fillOpacity,
              },
            ]}
          />
          <View style={styles.chunkIcon}>
            <Icon size={15} color={pal.ink} strokeWidth={2} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: notebook.ink,
  },
  date: {
    marginTop: 6,
    fontSize: 14,
    color: notebook.inkMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    minHeight: 34,
  },
  chunk: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8ecf0',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chunkIcon: {
    zIndex: 1,
  },
  fabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
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

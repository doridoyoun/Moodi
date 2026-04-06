import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Surface } from 'react-native-paper';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import NotebookLayout from '../components/NotebookLayout';
import { moodOrder, moodPalette, notebook } from '../constants/theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** Demo: April 2026 mood colors for days 1–6 (matches reference). */
const DEMO_MOODS_APRIL_2026 = {
  1: 'happy',
  2: 'calm',
  3: 'flutter',
  4: 'gloom',
  5: 'annoyed',
  6: 'happy',
};

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

export default function CalendarScreen() {
  const [cursor, setCursor] = useState(() => new Date(2026, 3, 1));

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

  const shiftMonth = (delta) => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

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
              const moodKey =
                year === 2026 && monthIndex === 3
                  ? DEMO_MOODS_APRIL_2026[day]
                  : undefined;
              const mood = moodKey ? moodPalette[moodKey] : null;
              return (
                <View key={`d-${day}`} style={styles.cell}>
                  <View
                    style={[
                      styles.dayChip,
                      mood && {
                        backgroundColor: mood.bg,
                        borderColor: mood.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        mood
                          ? { color: mood.ink, fontWeight: '700' }
                          : { color: notebook.inkMuted },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.legend}>
            {moodOrder.map((key) => {
              const m = moodPalette[key];
              return (
                <View key={key} style={styles.legendItem}>
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
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
    minHeight: 40,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChip: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  dayText: {
    textAlign: 'center',
    fontSize: 13,
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

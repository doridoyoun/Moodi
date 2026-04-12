import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Surface } from 'react-native-paper';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import NotebookLayout from '../components/NotebookLayout';
import { useMood } from '../src/context/MoodContext';
import { moodOrder, moodPalette, notebook } from '../constants/theme';
import { computeTopTwoEmotionIdsFromEntries } from '../storage/timelineStateStorage';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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

export default function CalendarScreen() {
  const navigation = useNavigation();
  const { entries, setSelectedDate } = useMood();
  const [cursor, setCursor] = useState(() => new Date());

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

  const goToTimeline = (day) => {
    const key = dateKeyForDay(year, monthIndex, day);
    setSelectedDate(key);
    navigation.navigate({
      name: 'Timeline',
      merge: true,
    });
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
              const key = dateKeyForDay(year, monthIndex, day);
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
                    onPress={() => goToTimeline(day)}
                    style={({ pressed }) => [styles.dayCell, pressed && styles.dayPressActive]}
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
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

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
  dayPressActive: {
    opacity: 0.82,
  },
  dayText: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
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

import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import NotebookLayout from '../components/NotebookLayout';
import { useMood } from '../src/context/MoodContext';
import { moodOrder, moodPalette, notebook } from '../constants/theme';
import { buildMonthFlowRows } from '../utils/monthlyFlowHelpers';

/** Full-height bar for days with records */
const RECORD_BAR_HEIGHT = 22;
/** Thinner, low-contrast placeholder for no-record days */
const EMPTY_BAR_HEIGHT = 11;

export default function MonthlyFlowView() {
  const navigation = useNavigation();
  const route = useRoute();
  const { entries, setSelectedDate } = useMood();

  const year = route.params?.year;
  const monthIndex = route.params?.monthIndex;

  const { y, m, title } = useMemo(() => {
    const now = new Date();
    const yy = typeof year === 'number' && Number.isFinite(year) ? year : now.getFullYear();
    const mm =
      typeof monthIndex === 'number' && monthIndex >= 0 && monthIndex <= 11
        ? monthIndex
        : now.getMonth();
    const d = new Date(yy, mm, 1);
    const t = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    return { y: yy, m: mm, title: t };
  }, [year, monthIndex]);

  const rows = useMemo(() => buildMonthFlowRows(entries, y, m), [entries, y, m]);

  const goToDay = useCallback(
    (dateKey) => {
      setSelectedDate(dateKey);
      const tabNav = navigation.getParent();
      if (tabNav) {
        tabNav.navigate('Timeline');
      }
    },
    [navigation, setSelectedDate],
  );

  return (
    <NotebookLayout>
      <View style={styles.screenRoot}>
        <View style={styles.localHeader}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
          >
            <ChevronLeft size={24} color={notebook.inkMuted} strokeWidth={2} />
          </Pressable>
          <Text style={styles.screenTitle}>이번 달 감정 흐름</Text>
          <View style={styles.backPlaceholder} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.pagePad}
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.monthHeading}>{title}</Text>
        <Text style={styles.subtle}>
          하루 기록의 감정 구성 · 좋음 → 설렘 → 잔잔 → 가라앉음 → 짜증 순
        </Text>

        <View style={styles.list}>
          {rows.map(({ dateKey, label, counts, total }) => (
            <Pressable
              key={dateKey}
              onPress={() => goToDay(dateKey)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${label} 타임라인으로`}
            >
              <Text style={styles.dateCol}>{label}</Text>
              <View style={styles.barWrap}>
                {total === 0 ? (
                  <View style={styles.barEmpty} />
                ) : (
                  <View style={styles.barRow}>
                    {moodOrder.map((emotionId) => {
                      const n = counts[emotionId] ?? 0;
                      return (
                        <View
                          key={`${dateKey}-${emotionId}`}
                          style={[
                            styles.segment,
                            {
                              flex: n > 0 ? n : 0,
                              backgroundColor: moodPalette[emotionId].bg,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>
        </ScrollView>
      </View>
    </NotebookLayout>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  localHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  backBtn: {
    padding: 6,
    width: 40,
  },
  backPlaceholder: {
    width: 40,
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
  },
  scroll: {
    flex: 1,
  },
  pagePad: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },
  monthHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: notebook.ink,
    marginBottom: 4,
  },
  subtle: {
    fontSize: 12,
    color: notebook.inkLight,
    marginBottom: 16,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  rowPressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
  },
  dateCol: {
    width: 52,
    fontSize: 14,
    fontWeight: '700',
    color: notebook.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  barWrap: {
    flex: 1,
    minWidth: 0,
  },
  barRow: {
    flexDirection: 'row',
    height: RECORD_BAR_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  segment: {
    minWidth: 0,
  },
  barEmpty: {
    height: EMPTY_BAR_HEIGHT,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.028)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.045)',
  },
});

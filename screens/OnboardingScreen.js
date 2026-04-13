import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Leaf, Smile, CloudRain, Flame } from 'lucide-react-native';
import { moodOrder, moodPalette, notebook } from '../constants/theme';

const SLIDES = [
  {
    headline: '오늘의 감정을 가볍게 남겨보세요',
    sub: '복잡하게 적지 않아도 괜찮아요\n한 번의 터치로 충분해요',
    visual: 'emotions',
  },
  {
    headline: '감정은 흐름으로 쌓여요',
    sub: '하루를 지나며\n감정이 자연스럽게 이어져요',
    visual: 'timeline',
  },
  {
    headline: '하루를 하나의 장면으로',
    sub: '감정과 사진을 모아\n오늘을 남겨보세요',
    visual: 'grid',
  },
];

const moodIcons = {
  happy: Smile,
  flutter: Heart,
  calm: Leaf,
  gloom: CloudRain,
  annoyed: Flame,
};

const GRID_BG = [
  moodPalette.happy.bg,
  moodPalette.flutter.bg,
  moodPalette.calm.bg,
  moodPalette.gloom.bg,
];

const TIMELINE_GRADIENT = [
  moodPalette.happy.bg,
  moodPalette.flutter.bg,
  moodPalette.calm.bg,
  moodPalette.gloom.bg,
  moodPalette.annoyed.bg,
];

/**
 * @param {{ active: boolean, children: import('react').ReactNode }} props
 */
function AnimatedSlide({ active, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!active) return;
    opacity.setValue(0);
    translateY.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 460,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 460,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, opacity, translateY]);

  return (
    <Animated.View style={[styles.slideInner, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function VisualEmotionRow() {
  return (
    <View style={styles.emotionRow}>
      {moodOrder.map((key) => {
        const m = moodPalette[key];
        const Icon = moodIcons[key];
        return (
          <View key={key} style={[styles.emotionChip, { backgroundColor: m.bg, borderColor: m.border }]}>
            <Icon size={20} color={m.ink} strokeWidth={2} />
            <Text style={[styles.emotionChipLabel, { color: m.ink }]} numberOfLines={1}>
              {m.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function VisualTimelineBar() {
  return (
    <View style={styles.timelineWrap}>
      <LinearGradient
        colors={TIMELINE_GRADIENT}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.timelineGradient}
      />
    </View>
  );
}

function VisualPhotoGrid() {
  return (
    <View style={styles.photoGrid}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[styles.photoCell, { backgroundColor: GRID_BG[i] }]}
        />
      ))}
    </View>
  );
}

/**
 * @param {{ onComplete: () => void | Promise<void> }} props
 */
export default function OnboardingScreen({ onComplete }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const { height: windowH } = useWindowDimensions();
  const pageMinH = Math.max(460, windowH * 0.58);

  const finish = useCallback(async () => {
    await onComplete();
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (page >= SLIDES.length - 1) {
      finish();
      return;
    }
    setPage((p) => p + 1);
  }, [page, finish]);

  const isLast = page === SLIDES.length - 1;
  const slide = SLIDES[page];

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <Pressable
          onPress={finish}
          hitSlop={12}
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.65 }]}
          accessibilityRole="button"
          accessibilityLabel="건너뛰기"
        >
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      </View>

      <View style={[styles.pager, { minHeight: pageMinH }]}>
        <View style={styles.page} key={page}>
          <AnimatedSlide active>
            <View style={styles.topSpacer} />
            <Text style={styles.headline}>{slide.headline}</Text>
            <Text style={styles.subtext} numberOfLines={2}>
              {slide.sub}
            </Text>
            <View style={styles.visualMount}>
              {slide.visual === 'emotions' && <VisualEmotionRow />}
              {slide.visual === 'timeline' && <VisualTimelineBar />}
              {slide.visual === 'grid' && <VisualPhotoGrid />}
            </View>
          </AnimatedSlide>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel={isLast ? '시작하기' : '다음'}
        >
          <Text style={styles.ctaText}>{isLast ? '시작하기' : '다음'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: notebook.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    minHeight: 44,
  },
  topBarSpacer: {
    flex: 1,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: notebook.inkLight,
  },
  pager: {
    flex: 1,
    width: '100%',
  },
  page: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  slideInner: {
    width: '100%',
  },
  topSpacer: {
    height: 56,
  },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: notebook.ink,
    lineHeight: 34,
    marginBottom: 16,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    fontWeight: '500',
    color: notebook.inkMuted,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 36,
    maxWidth: 320,
    alignSelf: 'center',
  },
  visualMount: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  emotionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 340,
  },
  emotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  emotionChipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineWrap: {
    width: '100%',
    maxWidth: 300,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  timelineGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 220,
    gap: 10,
    justifyContent: 'center',
  },
  photoCell: {
    width: 100,
    height: 100,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  footer: {
    paddingHorizontal: 28,
    gap: 22,
    paddingTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
  },
  dotActive: {
    width: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
  },
  cta: {
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: notebook.ink,
  },
});

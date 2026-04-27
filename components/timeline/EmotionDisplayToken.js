import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatEntryTime, paletteFor } from '../../utils/timelineEntryFormat';
import { notebook } from '../../constants/theme';

const SIZES = {
  sm: { circle: 28, border: 2, timeFont: 10 },
  /** Slightly larger than strip; detail surfaces only (not action-sized). */
  detail: { circle: 36, border: 2, timeFont: 12 },
  md: { circle: 40, border: 2.5, timeFont: 12 },
};

/**
 * Display-only emotion token: palette-colored circle + optional time label.
 */
export default function EmotionDisplayToken({
  emotionId,
  createdAt,
  onPress,
  size = 'sm',
  showTime = true,
  /** Optional display-only override (e.g. `07:--` for past hour slot). */
  timeText = null,
  accessibilityLabel,
  /** Strip away extra min touch width for inline / modal display rows */
  compact = false,
}) {
  const pal = paletteFor(emotionId);
  const dim = SIZES[size] || SIZES.sm;

  const circle = (
    <View
      style={[
        styles.circle,
        {
          width: dim.circle,
          height: dim.circle,
          borderRadius: dim.circle / 2,
          backgroundColor: pal.bg,
          borderColor: pal.border,
          borderWidth: dim.border,
        },
      ]}
    />
  );

  const inner = (
    <>
      {circle}
      {showTime && createdAt ? (
        <Text style={[styles.time, { fontSize: dim.timeFont }]}>{timeText ?? formatEntryTime(createdAt)}</Text>
      ) : null}
    </>
  );

  const wrapStyle = [styles.wrap, compact && styles.wrapCompact];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...wrapStyle, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={wrapStyle}>{inner}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 44,
    paddingVertical: 4,
  },
  wrapCompact: {
    minWidth: 0,
    paddingVertical: 0,
    alignSelf: 'center',
  },
  circle: {
    alignSelf: 'center',
  },
  time: {
    marginTop: 4,
    color: notebook.inkLight,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.82,
  },
});

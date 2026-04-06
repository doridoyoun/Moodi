import { Dimensions, StyleSheet, View } from 'react-native';
import { notebook } from '../constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const ROW_STEP = 14;
const COL_STEP = 14;
const ROWS = Math.ceil(H / ROW_STEP) + 2;
const COLS = Math.ceil(W / COL_STEP) + 2;

export default function NotebookBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: ROWS }).map((_, i) => (
        <View
          key={`h-${i}`}
          style={[styles.hLine, { top: (i + 1) * ROW_STEP }]}
        />
      ))}
      {Array.from({ length: COLS }).map((_, i) => (
        <View
          key={`v-${i}`}
          style={[styles.vLine, { left: (i + 1) * COL_STEP }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: notebook.gridLine,
  },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: notebook.gridLine,
  },
});

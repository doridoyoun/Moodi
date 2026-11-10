import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { notebook } from '../constants/theme';

const ROW_STEP = 14;
const COL_STEP = 14;

function NotebookBackground() {
  const { width, height } = useWindowDimensions();
  const rows = Math.ceil(height / ROW_STEP) + 2;
  const cols = Math.ceil(width / COL_STEP) + 2;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={`h-${i}`}
          style={[styles.hLine, { top: (i + 1) * ROW_STEP }]}
        />
      ))}
      {Array.from({ length: cols }).map((_, i) => (
        <View
          key={`v-${i}`}
          style={[styles.vLine, { left: (i + 1) * COL_STEP }]}
        />
      ))}
    </View>
  );
}

export default memo(NotebookBackground);

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

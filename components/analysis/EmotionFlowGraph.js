import { Fragment, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { notebook } from '../../constants/theme';
import { paletteFor } from '../../utils/timelineEntryFormat';

const PAD = { left: 14, right: 14, top: 10, bottom: 10 };

const OVERLAP_X_THRESHOLD_PX = 1;
const JITTER_BASE_D_PX = 6;
const JITTER_MAX_TOTAL_SPREAD_PX = 18;

/**
 * @param {{ x: number, y: number }[]} pts
 */
function straightPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i += 1) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

/**
 * @param {{ kind: 'single' | 'two' | 'multi', points: { emotionId: string, yValue: number, xRatio: number, r?: number, label?: string }[] }} flowGraph
 */
export default function EmotionFlowGraph({ flowGraph, selectedIndex = null, onSelectIndex = null }) {
  const [w, setW] = useState(0);
  const h = 156;

  const onLayout = (e) => {
    setW(e.nativeEvent.layout.width);
  };

  const { linePath, circles, selectedLabel } = useMemo(() => {
    const innerW = Math.max(0, w - PAD.left - PAD.right);
    const innerH = h - PAD.top - PAD.bottom;
    const points = flowGraph?.points ?? [];
    if (points.length === 0 || innerW <= 0) {
      return { linePath: '', circles: [], selectedLabel: null };
    }

    const yToPx = (yVal) => PAD.top + ((5 - yVal) / 4) * innerH;

    const pxPts = points.map((p) => {
      const x = PAD.left + p.xRatio * innerW;
      return {
        x,
        renderX: x,
        y: yToPx(p.yValue),
        emotionId: p.emotionId,
        r: typeof p.r === 'number' ? p.r : 5,
        label: typeof p.label === 'string' ? p.label : null,
      };
    });

    // Visual-only horizontal jitter for points that share the same (or nearly same) x.
    // This keeps time accuracy intact by never changing the time-based x calculation.
    if (pxPts.length > 1) {
      const indexed = pxPts
        .map((p, idx) => ({ ...p, idx }))
        .slice()
        .sort((a, b) => a.x - b.x || a.idx - b.idx);

      const groups = [];
      let current = [];
      for (let i = 0; i < indexed.length; i += 1) {
        const p = indexed[i];
        if (current.length === 0) {
          current.push(p);
          continue;
        }
        const prev = current[current.length - 1];
        if (Math.abs(p.x - prev.x) <= OVERLAP_X_THRESHOLD_PX) {
          current.push(p);
        } else {
          groups.push(current);
          current = [p];
        }
      }
      if (current.length) groups.push(current);

      for (const g of groups) {
        const n = g.length;
        if (n <= 1) continue;

        // Base spacing d=6px, capped so total spread stays within ~12~18px.
        // total spread = (n - 1) * d
        const d = Math.min(JITTER_BASE_D_PX, JITTER_MAX_TOTAL_SPREAD_PX / (n - 1));
        for (let k = 0; k < n; k += 1) {
          // Symmetric offsets: [-d, +d], [-d, 0, +d], [-1.5d, -0.5d, +0.5d, +1.5d], ...
          const offset = (k - (n - 1) / 2) * d;
          const originalIdx = g[k].idx;
          pxPts[originalIdx].renderX = pxPts[originalIdx].x + offset;
        }
      }
    }

    if (points.length === 1) {
      const cx = PAD.left + innerW * 0.5;
      const cy = yToPx(points[0].yValue);
      return {
        linePath: '',
        circles: [{
          cx,
          cy,
          emotionId: points[0].emotionId,
          r: typeof points[0].r === 'number' ? points[0].r : 5,
          label: typeof points[0].label === 'string' ? points[0].label : null,
        }],
        selectedLabel: null,
      };
    }

    return {
      linePath: straightPath(pxPts.map((p) => ({ x: p.x, y: p.y }))),
      circles: pxPts.map((p) => ({
        cx: p.renderX,
        cy: p.y,
        emotionId: p.emotionId,
        r: p.r,
        label: p.label,
      })),
      selectedLabel: null,
    };
  }, [flowGraph, w, h, selectedIndex]);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {linePath ? (
            <Path
              d={linePath}
              stroke={notebook.inkMuted}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.7}
            />
          ) : null}
          {circles.map((c, i) => {
            const pal = paletteFor(c.emotionId);
            const selected = selectedIndex === i;
            const baseR = c.r;
            const r = selected ? baseR + 1.5 : baseR;
            const strokeW = selected ? 2.5 : 1.5;
            const hitR = 20;
            return (
              <Fragment key={`seg-${i}`}>
                <Circle
                  cx={c.cx}
                  cy={c.cy}
                  r={hitR}
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={1}
                  onPress={() => {
                    if (typeof onSelectIndex === 'function') onSelectIndex(i);
                  }}
                />
                <Circle
                  cx={c.cx}
                  cy={c.cy}
                  r={r}
                  fill={pal.bg}
                  stroke={selected ? notebook.inkMuted : pal.border}
                  strokeWidth={strokeW}
                  onPress={() => {
                    if (typeof onSelectIndex === 'function') onSelectIndex(i);
                  }}
                />
              </Fragment>
            );
          })}
          {selectedIndex != null && circles[selectedIndex] && circles[selectedIndex].label ? (
            <SvgText
              x={circles[selectedIndex].cx}
              y={Math.max(PAD.top + 10, circles[selectedIndex].cy - (circles[selectedIndex].r + 10))}
              fontSize={11}
              fontWeight="700"
              fill={notebook.inkMuted}
              textAnchor="middle"
            >
              {circles[selectedIndex].label}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    minHeight: 156,
  },
});

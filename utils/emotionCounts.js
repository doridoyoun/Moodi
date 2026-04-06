import { moodPalette } from '../constants/theme';

/**
 * Aggregates chunk counts for one day (timeline hour map).
 * Kept for possible future UI / analytics (not tied to any screen).
 *
 * @param {Record<number, unknown[]> | null | undefined} hourMap — one day from timelineByDate
 * @returns {{ 행복: number, 설렘: number, 평온: number, 울적: number, 짜증: number }}
 */
export function countEmotionsByLabelForDay(hourMap) {
  const out = { 행복: 0, 설렘: 0, 평온: 0, 울적: 0, 짜증: 0 };
  if (!hourMap || typeof hourMap !== 'object') return out;

  for (let h = 0; h < 24; h += 1) {
    const row = hourMap[h];
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (!cell?.emotionId || typeof cell.count !== 'number') continue;
      const label = moodPalette[cell.emotionId]?.label;
      if (label && Object.prototype.hasOwnProperty.call(out, label)) {
        out[label] += cell.count;
      }
    }
  }
  return out;
}

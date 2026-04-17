/**
 * Rule-based calendar feedback: one soft sentence from selected-day + recent records.
 * Record shape: { type: EmotionLabel, timestamp: Date }
 */

import { moodPalette } from '../constants/theme';
import { addDaysToDateKey, getEntryTimelineDateKey, toDateKey } from '../storage/timelineStateStorage';

/** @typedef {'좋음'|'설렘'|'평온'|'가라앉음'|'짜증'} EmotionLabel */

const LABEL_ORDER = /** @type {const} */ (['좋음', '설렘', '평온', '가라앉음', '짜증']);

const DOMINANT_SELECTED_MSG = {
  좋음: '오늘은 기분 좋은 순간이 많이 남아 있어요',
  설렘: '오늘은 설레는 순간이 자주 보였어요',
  평온: '오늘은 전체적으로 평온한 흐름이 느껴져요',
  가라앉음: '오늘은 조금 차분하게 가라앉은 순간이 많았어요',
  짜증: '오늘은 예민했던 순간이 자주 남아 있어요',
};

const DOMINANT_RECENT_MSG = {
  좋음: '요즘은 기분 좋은 순간이 자주 쌓이고 있어요',
  설렘: '요즘은 설레는 감정이 자주 보이고 있어요',
  평온: '요즘은 평온한 흐름이 이어지고 있어요',
  가라앉음: '요즘은 조금 가라앉은 순간이 자주 보이고 있어요',
  짜증: '요즘은 예민한 순간이 조금 늘어난 것 같아요',
};

const TIME_GROUP_MSG = {
  morning: '최근엔 아침 시간에 감정이 자주 남고 있어요',
  day: '최근엔 낮 시간대 기록이 조금 더 많아요',
  evening: '최근엔 저녁 시간에 감정이 자주 남고 있어요',
  night: '최근엔 밤에 남긴 기록이 많아 보여요',
};

const MIXED_MSG = '오늘은 여러 감정이 함께 지나간 하루였어요';
const CONSISTENCY_MSG = '감정 기록이 차곡차곡 잘 쌓이고 있어요';
const FALLBACK_MSG = '오늘의 감정이 조용히 쌓여가고 있어요';

/**
 * @param {Date} d
 * @returns {'morning'|'day'|'evening'|'night'}
 */
export function getTimeGroup(d) {
  const h = d.getHours();
  if (h >= 5 && h <= 10) return 'morning';
  if (h >= 11 && h <= 16) return 'day';
  if (h >= 17 && h <= 20) return 'evening';
  return 'night';
}

/**
 * @param {{ type: string, timestamp: Date }[]} records
 * @returns {Record<string, number>}
 */
export function countByEmotionLabel(records) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const k of LABEL_ORDER) out[k] = 0;
  for (const r of records) {
    if (r?.type && Object.prototype.hasOwnProperty.call(out, r.type)) {
      out[r.type] += 1;
    }
  }
  return out;
}

/**
 * @param {{ type: string, timestamp: Date }[]} records
 * @returns {{ label: EmotionLabel, ratio: number } | null}
 */
function getDominantLabel(records) {
  const n = records.length;
  if (n === 0) return null;
  const counts = countByEmotionLabel(records);
  let best = LABEL_ORDER[0];
  let bestCount = -1;
  for (const label of LABEL_ORDER) {
    if (counts[label] > bestCount) {
      bestCount = counts[label];
      best = label;
    }
  }
  return { label: /** @type {EmotionLabel} */ (best), ratio: bestCount / n };
}

/**
 * @param {object[]} moodEntries — MoodEntry from storage
 * @returns {{ type: EmotionLabel, timestamp: Date }[]}
 */
export function moodiFeedbackRecordsFromMoodEntries(moodEntries) {
  if (!Array.isArray(moodEntries)) return [];
  const out = [];
  for (const e of moodEntries) {
    const id = e?.emotionId;
    const label = id && moodPalette[id] ? moodPalette[id].label : null;
    if (!label || !LABEL_ORDER.includes(/** @type * */ (label))) continue;
    const t = e?.createdAt ? new Date(e.createdAt) : null;
    if (!t || Number.isNaN(t.getTime())) continue;
    out.push({ type: /** @type {EmotionLabel} */ (label), timestamp: t });
  }
  return out;
}

/**
 * Mood entries from the last `days` calendar days (inclusive of today).
 * @param {object[]} allEntries
 * @param {number} days
 */
export function getMoodEntriesRecentDays(allEntries, days) {
  if (!Array.isArray(allEntries) || days < 1) return [];
  const todayKey = toDateKey(new Date());
  const startKey = addDaysToDateKey(todayKey, -(days - 1));
  const out = [];
  for (const e of allEntries) {
    const dk = getEntryTimelineDateKey(e);
    if (!dk) continue;
    if (dk >= startKey && dk <= todayKey) out.push(e);
  }
  return out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/**
 * @param {{ type: string, timestamp: Date }[]} recentRecords
 * @returns {number} distinct local calendar days with at least one record
 */
function countDistinctDaysWithRecords(recentRecords) {
  const set = new Set();
  for (const r of recentRecords) {
    const d = r.timestamp;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    set.add(key);
  }
  return set.size;
}

/**
 * @param {{ type: string, timestamp: Date }[]} selectedDateRecords
 * @param {{ type: string, timestamp: Date }[]} recentRecords
 * @returns {string}
 */
export function getMoodiFeedback(selectedDateRecords, recentRecords) {
  const sel = Array.isArray(selectedDateRecords) ? selectedDateRecords : [];
  const recent = Array.isArray(recentRecords) ? recentRecords : [];

  // [A] Dominant emotion (selected day)
  if (sel.length >= 3) {
    const dom = getDominantLabel(sel);
    if (dom && dom.ratio >= 0.5) {
      const msg = DOMINANT_SELECTED_MSG[dom.label];
      if (msg) return msg;
    }
  }

  // [B] Mixed emotions (selected day)
  if (sel.length >= 4) {
    const counts = countByEmotionLabel(sel);
    const n = sel.length;
    let maxRatio = 0;
    for (const label of LABEL_ORDER) {
      maxRatio = Math.max(maxRatio, counts[label] / n);
    }
    const types = LABEL_ORDER.filter((l) => counts[l] > 0).length;
    if (maxRatio < 0.45 && types >= 3) {
      return MIXED_MSG;
    }
  }

  // [C] Time concentration (selected day)
  if (sel.length >= 3) {
    /** @type {Record<string, number>} */
    const tg = { morning: 0, day: 0, evening: 0, night: 0 };
    for (const r of sel) {
      tg[getTimeGroup(r.timestamp)] += 1;
    }
    const n = sel.length;
    for (const g of ['morning', 'day', 'evening', 'night']) {
      if (tg[g] / n >= 0.6) {
        return TIME_GROUP_MSG[g];
      }
    }
  }

  // [D] Dominant emotion (recent 7 days)
  if (recent.length >= 5) {
    const dom = getDominantLabel(recent);
    if (dom && dom.ratio >= 0.4) {
      const msg = DOMINANT_RECENT_MSG[dom.label];
      if (msg) return msg;
    }
  }

  // [E] Consistency
  if (countDistinctDaysWithRecords(recent) >= 4) {
    return CONSISTENCY_MSG;
  }

  // [F] Fallback
  return FALLBACK_MSG;
}

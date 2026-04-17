/**
 * Calendar tab: pattern insight + monthly bar data helpers.
 * Canonical emotions: happy | excited | calm | down | angry (maps from app emotionId).
 */

import { addDaysToDateKey, getEntryTimelineDateKey, getEntryTimelineHour, toDateKey } from '../storage/timelineStateStorage';
import { buildMonthFlowRows } from './monthlyFlowHelpers';

/** @typedef {'happy' | 'excited' | 'calm' | 'down' | 'angry'} CanonicalEmotion */

const ID_TO_CANONICAL = {
  happy: 'happy',
  flutter: 'excited',
  calm: 'calm',
  gloom: 'down',
  annoyed: 'angry',
};

const LABEL_KO = {
  happy: '좋음',
  excited: '설렘',
  calm: '평온',
  down: '가라앉음',
  angry: '짜증',
};

const NEGATIVE = new Set(['down', 'angry']);

/**
 * @param {object} e
 * @returns {CanonicalEmotion | null}
 */
export function entryToCanonical(e) {
  const id = e?.emotionId;
  if (!id || !Object.prototype.hasOwnProperty.call(ID_TO_CANONICAL, id)) return null;
  return ID_TO_CANONICAL[id];
}

/**
 * Entries whose timeline day falls in the inclusive [today - (days-1), today] window.
 * @param {object[]} entries
 * @param {number} days
 * @returns {object[]}
 */
export function getRecentEntries(entries, days) {
  if (!Array.isArray(entries) || days < 1) return [];
  const todayKey = toDateKey(new Date());
  const startKey = addDaysToDateKey(todayKey, -(days - 1));
  const out = [];
  for (const e of entries) {
    const dk = getEntryTimelineDateKey(e);
    if (!dk) continue;
    if (dk >= startKey && dk <= todayKey) out.push(e);
  }
  return out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/**
 * @param {object[]} entries
 * @returns {Record<CanonicalEmotion, number>}
 */
export function countByEmotion(entries) {
  /** @type {Record<string, number>} */
  const out = { happy: 0, excited: 0, calm: 0, down: 0, angry: 0 };
  for (const e of entries) {
    const c = entryToCanonical(e);
    if (c) out[c] += 1;
  }
  return /** @type {Record<CanonicalEmotion, number>} */ (out);
}

/**
 * @param {object[]} entries
 * @returns {number}
 */
export function getUniqueEmotionCount(entries) {
  const set = new Set();
  for (const e of entries) {
    const c = entryToCanonical(e);
    if (c) set.add(c);
  }
  return set.size;
}

/**
 * @param {object[]} entries
 * @returns {{ emotion: CanonicalEmotion, count: number, ratio: number } | null}
 */
export function getDominantEmotion(entries) {
  const counts = countByEmotion(entries);
  const n = entries.length;
  if (n === 0) return null;
  /** @type {CanonicalEmotion[]} */
  const order = ['happy', 'excited', 'calm', 'down', 'angry'];
  let best = null;
  let bestCount = 0;
  for (const em of order) {
    if (counts[em] > bestCount) {
      bestCount = counts[em];
      best = em;
    }
  }
  if (!best) return null;
  return { emotion: best, count: bestCount, ratio: bestCount / n };
}

/**
 * Evening = hour in [18, 23] (18:00–24:00 exclusive of midnight next day).
 * @param {object[]} entries
 * @returns {number} 0..1
 */
export function getEveningRatio(entries) {
  if (!entries.length) return 0;
  let ev = 0;
  for (const e of entries) {
    const h = getEntryTimelineHour(e);
    if (h >= 18 && h <= 23) ev += 1;
  }
  return ev / entries.length;
}

/**
 * @param {object[]} entries
 * @returns {number} 0..1
 */
export function getNegativeRatio(entries) {
  if (!entries.length) return 0;
  let n = 0;
  for (const e of entries) {
    const c = entryToCanonical(e);
    if (c && NEGATIVE.has(c)) n += 1;
  }
  return n / entries.length;
}

/**
 * Split chronological entries into older half vs newer half (floor/ceil).
 * @param {object[]} sortedChronological
 * @returns {{ older: object[], newer: object[] }}
 */
export function splitEntriesIntoOlderAndNewer(sortedChronological) {
  const a = [...sortedChronological].sort(
    (x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt),
  );
  const n = a.length;
  if (n === 0) return { older: [], newer: [] };
  const mid = Math.floor(n / 2);
  return { older: a.slice(0, mid), newer: a.slice(mid) };
}

/**
 * @param {object[]} entries — any window
 * @returns {Record<string, number>} dateKey → count
 */
export function getDailyActivityMap(entries) {
  const map = {};
  for (const e of entries) {
    const dk = getEntryTimelineDateKey(e);
    if (!dk) continue;
    map[dk] = (map[dk] || 0) + 1;
  }
  return map;
}

function pickVariant(two, seed) {
  return two[Math.abs(seed) % 2];
}

function tryIncreasingNegative(recent, seed) {
  if (recent.length < 4) return null;
  const { older, newer } = splitEntriesIntoOlderAndNewer(recent);
  if (older.length === 0 || newer.length === 0) return null;
  const ro = getNegativeRatio(older);
  const rn = getNegativeRatio(newer);
  if (rn - ro < 0.3) return null;
  const msgs = ['최근 조금 무거운 감정이 늘고 있어요', "요즘 '가라앉음'이나 '짜증'이 늘어난 것 같아요"];
  return pickVariant(msgs, seed);
}

function tryDominantEmotion(recent, seed) {
  if (recent.length < 4) return null;
  const d = getDominantEmotion(recent);
  if (!d || d.ratio < 0.5) return null;
  const label = LABEL_KO[d.emotion];
  const variants = [
    `최근 '${label}'이 자주 보여요`,
    `요즘 '${label}'이 자주 기록되고 있어요`,
    `최근 '${label}'이 자주 보이네요`,
  ];
  return variants[seed % 3];
}

function tryEveningConcentration(recent, seed) {
  if (recent.length < 4) return null;
  if (getEveningRatio(recent) < 0.6) return null;
  const msgs = ['최근 저녁 시간대에 기록이 많아요', '감정이 저녁에 더 자주 남겨지고 있어요'];
  return pickVariant(msgs, seed);
}

function tryRepeatedPattern(recent, seed) {
  const sub = recent.slice(-6);
  if (sub.length < 5) return null;
  const counts = countByEmotion(sub);
  const max = Math.max(...Object.values(counts));
  if (max < 3) return null;
  const msgs = ['비슷한 감정 흐름이 반복되고 있어요', '최근 감정 패턴이 이어지고 있어요'];
  return pickVariant(msgs, seed);
}

function tryBalancedMix(recent, seed) {
  if (recent.length < 4) return null;
  const counts = countByEmotion(recent);
  const n = recent.length;
  if (getUniqueEmotionCount(recent) < 3) return null;
  for (const k of Object.keys(counts)) {
    if (counts[k] / n > 0.4) return null;
  }
  const msgs = ['최근 감정이 비교적 다양하게 기록되고 있어요', '요즘 감정 흐름이 한쪽으로 치우치지 않네요'];
  return pickVariant(msgs, seed);
}

function trySteadyRecording(allEntries, seed) {
  const w = getRecentEntries(allEntries, 7);
  const map = getDailyActivityMap(w);
  const activeDays = Object.keys(map).filter((k) => map[k] >= 1);
  if (activeDays.length < 3) return null;
  const msgs = ['기록이 꾸준히 이어지고 있어요', '요즘 감정을 자주 돌아보고 있네요'];
  return pickVariant(msgs, seed);
}

/**
 * @param {object[]} allEntries
 * @returns {string | null}
 */
export function getCalendarInsight(allEntries) {
  let recent = getRecentEntries(allEntries, 7);
  if (recent.length < 3) {
    recent = getRecentEntries(allEntries, 14);
  }
  if (recent.length < 3) return null;

  const seed = recent.reduce((s, e) => s + (e.id?.length || 0), 0);

  const line =
    tryIncreasingNegative(recent, seed) ??
    tryDominantEmotion(recent, seed) ??
    tryEveningConcentration(recent, seed) ??
    tryRepeatedPattern(recent, seed) ??
    tryBalancedMix(recent, seed) ??
    trySteadyRecording(allEntries, seed);

  if (line) return line;
  if (recent.length >= 3) return '최근 감정 기록을 가만히 살펴보고 있어요';
  return null;
}

/**
 * Neutral line when data is sparse.
 */
export const CALENDAR_INSIGHT_PLACEHOLDER = '기록이 쌓이면 여기서 패턴을 볼 수 있어요';

/**
 * Monthly proportional bars for calendar month (same shape as MonthlyFlowView rows).
 * @param {object[]} entries
 * @param {number} year
 * @param {number} monthIndex
 */
export function getMonthlyEmotionBarData(entries, year, monthIndex) {
  return buildMonthFlowRows(entries, year, monthIndex);
}

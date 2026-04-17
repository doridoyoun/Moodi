/**
 * Smart emotion toast: pattern-based triggers, daily caps, cooldown.
 * EmotionType matches spec; maps to app emotionIds via emotionTypeToId.
 */

/** @typedef {'happy' | 'excited' | 'calm' | 'down' | 'angry'} EmotionType */

/**
 * @typedef {Object} EmotionEntry
 * @property {string} id
 * @property {EmotionType} emotion
 * @property {string} createdAt
 */

/** @typedef {'first_entry' | 'repeated_emotion' | 'diversity' | 'consistency'} ToastType */

const EMOTION_ID_TO_TYPE = {
  happy: 'happy',
  flutter: 'excited',
  calm: 'calm',
  gloom: 'down',
  annoyed: 'angry',
};

const TYPE_TO_LABEL_KO = {
  happy: '좋음',
  excited: '설렘',
  calm: '평온',
  down: '가라앉음',
  angry: '짜증',
};

export const TOAST_PRIORITY = /** @type {const} */ ([
  'first_entry',
  'repeated_emotion',
  'diversity',
  'consistency',
]);

/**
 * @param {string | number | Date} a
 * @param {string | number | Date} b
 * @returns {number}
 */
export function minutesBetween(a, b) {
  const ta = typeof a === 'string' || typeof a === 'number' ? Date.parse(a) : a.getTime();
  const tb = typeof b === 'string' || typeof b === 'number' ? Date.parse(b) : b.getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Infinity;
  return Math.abs(tb - ta) / 60000;
}

/**
 * @param {EmotionEntry[]} entries
 * @returns {Record<EmotionType, number>}
 */
export function countByEmotion(entries) {
  /** @type {Record<string, number>} */
  const out = { happy: 0, excited: 0, calm: 0, down: 0, angry: 0 };
  for (const e of entries) {
    if (e?.emotion && Object.prototype.hasOwnProperty.call(out, e.emotion)) {
      out[e.emotion] += 1;
    }
  }
  return /** @type {Record<EmotionType, number>} */ (out);
}

/**
 * Last up to 3 entries; if any emotion appears ≥2 times, return that type.
 * @param {EmotionEntry[]} entries
 * @returns {EmotionType | null}
 */
export function getDominantRecentEmotion(entries) {
  const slice = entries.length <= 3 ? entries : entries.slice(-3);
  if (slice.length < 2) return null;
  const counts = countByEmotion(slice);
  /** @type {EmotionType[]} */
  const order = ['happy', 'excited', 'calm', 'down', 'angry'];
  for (const t of order) {
    if (counts[t] >= 2) return t;
  }
  return null;
}

/**
 * @param {EmotionEntry[]} entries
 * @returns {number}
 */
export function getUniqueEmotionCount(entries) {
  const set = new Set();
  for (const e of entries) {
    if (e?.emotion) set.add(e.emotion);
  }
  return set.size;
}

/**
 * @param {{ id?: string, emotionId?: string, createdAt?: string }} moodEntry
 * @returns {EmotionEntry | null}
 */
export function moodEntryToEmotionEntry(moodEntry) {
  if (!moodEntry?.id || !moodEntry?.createdAt) return null;
  const rawId = moodEntry.emotionId;
  const emotion = EMOTION_ID_TO_TYPE[rawId];
  if (!emotion) return null;
  return {
    id: moodEntry.id,
    emotion,
    createdAt: moodEntry.createdAt,
  };
}

/**
 * @param {object[]} moodEntriesSorted
 * @returns {EmotionEntry[]}
 */
export function moodEntriesToEmotionEntries(moodEntriesSorted) {
  const out = [];
  for (const e of moodEntriesSorted) {
    const x = moodEntryToEmotionEntry(e);
    if (x) out.push(x);
  }
  return out;
}

/**
 * @param {string} type
 * @param {{ todayToastCount: number, shownToastTypes: string[], lastToastAt: string | null }} state
 * @param {number | Date} now
 */
export function canShowToast(type, state, now) {
  if (state.todayToastCount >= 3) return false;
  if (state.shownToastTypes.includes(type)) return false;
  if (state.lastToastAt && minutesBetween(state.lastToastAt, now) < 10) return false;
  return true;
}

function lastWindowHasRepeatedEmotion(entries) {
  return getDominantRecentEmotion(entries) != null;
}

/**
 * Which toast types match conditions (before canShowToast).
 * @param {EmotionEntry[]} entries
 * @returns {Set<ToastType>}
 */
export function matchingToastTypes(entries) {
  /** @type {Set<ToastType>} */
  const set = new Set();
  if (entries.length === 1) set.add('first_entry');
  if (entries.length >= 2 && lastWindowHasRepeatedEmotion(entries)) {
    set.add('repeated_emotion');
  }
  if (getUniqueEmotionCount(entries) >= 3) set.add('diversity');
  if (entries.length === 3) set.add('consistency');
  return set;
}

/**
 * @param {ToastType} type
 * @param {EmotionEntry[]} entries
 * @returns {string}
 */
export function getToastMessage(type, entries) {
  switch (type) {
    case 'first_entry':
      return '오늘 첫 감정이 기록됐어요 🙂';
    case 'repeated_emotion': {
      const dom = getDominantRecentEmotion(entries);
      const label = dom ? TYPE_TO_LABEL_KO[dom] : '그 감정';
      const roll = entries.length % 2 === 0;
      if (roll) return '같은 감정이 이어지고 있어요';
      return `오늘은 '${label}'이 자주 보이네요`;
    }
    case 'diversity':
      return '오늘 감정이 다양하네요';
    case 'consistency':
      return '오늘 감정 기록이 잘 이어지고 있어요';
    default:
      return '';
  }
}

/**
 * Pick highest-priority toast type that matches AND passes canShowToast.
 * @param {EmotionEntry[]} entries
 * @param {{ todayToastCount: number, shownToastTypes: string[], lastToastAt: string | null }} state
 * @param {number | Date} now
 * @returns {ToastType | null}
 */
export function selectToastType(entries, state, now) {
  const matched = matchingToastTypes(entries);
  for (const t of TOAST_PRIORITY) {
    if (!matched.has(t)) continue;
    if (!canShowToast(t, state, now)) continue;
    return t;
  }
  return null;
}

/**
 * @param {ToastType} type
 * @param {{ todayToastCount: number, shownToastTypes: string[], lastToastAt: string | null }} state
 * @param {string} nowIso
 */
export function applyToastShown(type, state, nowIso) {
  return {
    todayToastCount: state.todayToastCount + 1,
    shownToastTypes: state.shownToastTypes.includes(type)
      ? state.shownToastTypes
      : [...state.shownToastTypes, type],
    lastToastAt: nowIso,
  };
}

export function emptyDayToastState() {
  return {
    todayToastCount: 0,
    shownToastTypes: [],
    lastToastAt: null,
  };
}

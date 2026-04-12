import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMELINE_BY_DATE_KEY = 'moodi_timeline_by_date_v1';

/** @typedef {'happy' | 'flutter' | 'calm' | 'gloom' | 'annoyed'} MoodEmotionId */

/**
 * @typedef {Object} MoodEntry
 * @property {string} id
 * @property {MoodEmotionId|string} emotionId
 * @property {string} memo
 * @property {string} createdAt
 */

/**
 * @typedef {{ emotionId: string, count: number, memo?: string }} ChunkCell
 * @typedef {(ChunkCell|null)[]} ChunkRow
 * @typedef {Record<number, ChunkRow>} HourChunksMap
 * @typedef {Record<string, HourChunksMap>} TimelineByDate
 */

const VALID_EMOTION_IDS = new Set(['happy', 'flutter', 'calm', 'gloom', 'annoyed']);

export function createEmptyChunks() {
  return Array.from({ length: 6 }, () => null);
}

export function createEmptyHourMap() {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  return Object.fromEntries(HOURS.map((h) => [h, createEmptyChunks()]));
}

function normalizeHourMap(raw) {
  const out = createEmptyHourMap();
  if (!raw || typeof raw !== 'object') return out;
  for (let h = 0; h < 24; h += 1) {
    const row = raw[h] ?? raw[String(h)];
    if (Array.isArray(row) && row.length === 6) {
      out[h] = row.map((c) =>
        c && c.emotionId && typeof c.count === 'number'
          ? {
              emotionId: c.emotionId,
              count: c.count,
              ...(typeof c.memo === 'string' ? { memo: c.memo } : {}),
            }
          : null,
      );
    }
  }
  return out;
}

/**
 * @returns {Promise<TimelineByDate>}
 */
export async function loadTimelineByDate() {
  try {
    const raw = await AsyncStorage.getItem(TIMELINE_BY_DATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    Object.keys(parsed).forEach((dateKey) => {
      out[dateKey] = normalizeHourMap(parsed[dateKey]);
    });
    return out;
  } catch {
    return {};
  }
}

/**
 * @param {TimelineByDate} data
 */
export async function saveTimelineByDate(data) {
  await AsyncStorage.setItem(TIMELINE_BY_DATE_KEY, JSON.stringify(data));
}

export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * "YYYY-MM-DD" 문자열을 안전하게 파싱 (ISO 문자열 결합 대신 split 사용)
 * @returns {{ year: number, monthIndex: number, day: number } | null}
 */
export function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string') return null;
  const parts = dateKey.trim().split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { year: y, monthIndex: mo - 1, day: d };
}

/**
 * 로컬 정오 기준 Date (타임존/파싱 이슈 완화)
 * @param {string} dateKey
 * @returns {Date}
 */
export function localDateFromDateKey(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return new Date(NaN);
  return new Date(p.year, p.monthIndex, p.day, 12, 0, 0, 0);
}

/**
 * @param {string} dateKey
 * @param {number} deltaDays
 * @returns {string} YYYY-MM-DD
 */
export function addDaysToDateKey(dateKey, deltaDays) {
  const dt = localDateFromDateKey(dateKey);
  if (Number.isNaN(dt.getTime())) return toDateKey(new Date());
  dt.setDate(dt.getDate() + deltaDays);
  return toDateKey(dt);
}

/**
 * 표시용 로케일 문자열
 * @param {string} dateKey
 * @param {string} [locale='ko-KR']
 */
export function formatDateKeyForDisplay(dateKey, locale = 'ko-KR') {
  const dt = localDateFromDateKey(dateKey);
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

// --- MoodEntry helpers ---

/**
 * @param {{ id?: string, emotionId?: string, memo?: string, createdAt?: string }} input
 * @returns {MoodEntry}
 */
export function createMoodEntry(input = {}) {
  const emotionId = VALID_EMOTION_IDS.has(String(input.emotionId))
    ? String(input.emotionId)
    : 'happy';
  const memo = typeof input.memo === 'string' ? input.memo.trim() : '';
  let createdAt =
    typeof input.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt))
      ? input.createdAt
      : new Date().toISOString();
  const id =
    typeof input.id === 'string' && input.id.trim().length > 0
      ? input.id.trim()
      : `e-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return { id, emotionId, memo, createdAt };
}

/**
 * @param {unknown} raw
 * @returns {MoodEntry[]}
 */
export function normalizeMoodEntries(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const id = typeof row.id === 'string' && row.id.trim().length > 0 ? row.id.trim() : null;
    const createdAt =
      typeof row.createdAt === 'string' && !Number.isNaN(Date.parse(row.createdAt))
        ? row.createdAt
        : null;
    if (!id || !createdAt) continue;
    const emotionId = VALID_EMOTION_IDS.has(String(row.emotionId))
      ? String(row.emotionId)
      : 'happy';
    const memo = typeof row.memo === 'string' ? row.memo.trim() : '';
    out.push({ id, emotionId, memo, createdAt });
  }
  return out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/**
 * @param {MoodEntry[]} entries
 * @returns {Record<string, MoodEntry[]>}
 */
export function groupEntriesByDate(entries) {
  const map = {};
  if (!Array.isArray(entries)) return map;
  for (const e of entries) {
    if (!e?.createdAt) continue;
    const dk = toDateKey(new Date(e.createdAt));
    if (!map[dk]) map[dk] = [];
    map[dk].push(e);
  }
  Object.keys(map).forEach((k) => {
    map[k].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  });
  return map;
}

/**
 * @param {MoodEntry[]} entries
 * @param {string} dateKey
 * @returns {MoodEntry[]}
 */
export function getEntriesForDate(entries, dateKey) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e) => {
      if (!e?.createdAt) return false;
      return toDateKey(new Date(e.createdAt)) === dateKey;
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/**
 * @param {MoodEntry[]} entries
 * @param {string} dateKey
 * @param {number} hour 0..23
 * @returns {MoodEntry[]}
 */
export function getEntriesForDateHour(entries, dateKey, hour) {
  return getEntriesForDate(entries, dateKey).filter((e) => {
    const h = new Date(e.createdAt).getHours();
    return h === hour;
  });
}

/**
 * @param {MoodEntry[]} entries
 * @param {string} dateKey
 * @returns {string[]} up to 2 ids
 */
export function computeTopTwoEmotionIdsFromEntries(entries, dateKey) {
  const day = getEntriesForDate(entries, dateKey);
  if (day.length === 0) return [];

  const byEmotion = {};
  for (const e of day) {
    const id = VALID_EMOTION_IDS.has(e.emotionId) ? e.emotionId : 'happy';
    if (!byEmotion[id]) {
      byEmotion[id] = { count: 0, firstAt: Date.parse(e.createdAt) };
    }
    byEmotion[id].count += 1;
    const t = Date.parse(e.createdAt);
    if (t < byEmotion[id].firstAt) byEmotion[id].firstAt = t;
  }

  const ids = Object.keys(byEmotion);
  ids.sort((a, b) => {
    const ca = byEmotion[a].count;
    const cb = byEmotion[b].count;
    if (cb !== ca) return cb - ca;
    return byEmotion[a].firstAt - byEmotion[b].firstAt;
  });
  return ids.slice(0, 2);
}

/**
 * @param {MoodEntry[]} entries
 * @param {string} dateKey
 * @returns {Record<number, MoodEntry[]>}
 */
export function buildTimelineHourMapFromEntries(entries, dateKey) {
  /** @type {Record<number, MoodEntry[]>} */
  const map = {};
  for (let h = 0; h < 24; h += 1) map[h] = [];
  const day = getEntriesForDate(entries, dateKey);
  for (const e of day) {
    const h = new Date(e.createdAt).getHours();
    map[h].push(e);
  }
  for (let h = 0; h < 24; h += 1) {
    map[h].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }
  return map;
}

function mergeChunkCellLike(prevCell, emotionId, memoText) {
  const memo = (memoText || '').trim();
  if (!prevCell) {
    return { emotionId, count: 1, memo };
  }
  if (prevCell.emotionId === emotionId) {
    return {
      emotionId,
      count: Math.min(3, prevCell.count + 1),
      memo: memo || prevCell.memo || '',
    };
  }
  return { emotionId, count: 1, memo };
}

/**
 * Rebuilds legacy chunk grid for one day from entries (chronological merge).
 * @param {MoodEntry[]} dayEntries
 * @returns {HourChunksMap}
 */
function buildLegacyHourMapFromDayEntries(dayEntries) {
  const sorted = [...dayEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  let hourMap = createEmptyHourMap();
  for (const e of sorted) {
    const d = new Date(e.createdAt);
    const h = d.getHours();
    const chunk = Math.min(5, Math.floor(d.getMinutes() / 10));
    const row = [...(hourMap[h] ?? createEmptyChunks())];
    const prev = row[chunk];
    row[chunk] = mergeChunkCellLike(prev, e.emotionId, e.memo);
    hourMap = { ...hourMap, [h]: row };
  }
  return hourMap;
}

/**
 * Bridge: entry list → legacy timeline shape for existing UI.
 * @param {MoodEntry[]} entries
 * @returns {TimelineByDate}
 */
export function buildLegacyTimelineByDateFromEntries(entries) {
  const grouped = groupEntriesByDate(entries);
  /** @type {TimelineByDate} */
  const out = {};
  for (const dateKey of Object.keys(grouped)) {
    out[dateKey] = buildLegacyHourMapFromDayEntries(grouped[dateKey]);
  }
  return out;
}

/**
 * @param {TimelineByDate} timelineByDate
 * @returns {MoodEntry[]}
 */
export function migrateLegacyTimelineByDateToEntries(timelineByDate) {
  /** @type {MoodEntry[]} */
  const out = [];
  if (!timelineByDate || typeof timelineByDate !== 'object') return [];

  const dateKeys = Object.keys(timelineByDate).sort();
  for (const dateKey of dateKeys) {
    const p = parseDateKey(dateKey);
    if (!p) continue;
    const dayMap = timelineByDate[dateKey];
    if (!dayMap || typeof dayMap !== 'object') continue;

    for (let hour = 0; hour < 24; hour += 1) {
      const row = dayMap[hour] ?? dayMap[String(hour)];
      if (!Array.isArray(row)) continue;

      for (let chunkIdx = 0; chunkIdx < 6; chunkIdx += 1) {
        const cell = row[chunkIdx];
        if (!cell || !cell.emotionId) continue;

        const count =
          typeof cell.count === 'number' && cell.count > 0 ? Math.min(3, Math.floor(cell.count)) : 1;
        const memo = typeof cell.memo === 'string' ? cell.memo.trim() : '';
        const emotionId = VALID_EMOTION_IDS.has(String(cell.emotionId)) ? cell.emotionId : 'happy';
        const baseMin = chunkIdx * 10 + 5;

        for (let i = 0; i < count; i += 1) {
          let minute = baseMin + i;
          let h = hour;
          while (minute >= 60) {
            h += 1;
            minute -= 60;
          }
          let createdAt;
          if (h >= 24) {
            const dt = new Date(p.year, p.monthIndex, p.day, 23, 59, i, 0);
            createdAt = dt.toISOString();
          } else {
            const dt = new Date(p.year, p.monthIndex, p.day, h, minute, 0, 0);
            createdAt = dt.toISOString();
          }
          const entryMemo = i === 0 ? memo : '';
          out.push(createMoodEntry({ emotionId, memo: entryMemo, createdAt }));
        }
      }
    }
  }

  return normalizeMoodEntries(out);
}

/**
 * 하루 칸 데이터에서 가장 많이 기록된(가중 count 합) 감정 id
 * @param {HourChunksMap|undefined|null} dayMap
 * @returns {string|null}
 */
function tallyEmotionsForDay(dayMap) {
  const tallies = {};
  if (!dayMap) return tallies;
  for (let h = 0; h < 24; h += 1) {
    const row = dayMap[h];
    if (!row) continue;
    for (const cell of row) {
      if (!cell?.emotionId) continue;
      tallies[cell.emotionId] = (tallies[cell.emotionId] || 0) + cell.count;
    }
  }
  return tallies;
}

export function computeRepresentativeEmotionId(dayMap) {
  const tallies = tallyEmotionsForDay(dayMap);
  const ids = Object.keys(tallies);
  if (ids.length === 0) return null;
  return ids.sort((a, b) => tallies[b] - tallies[a])[0];
}

/**
 * 가중 count 합 기준 상위 1·2위 감정 id (캘린더 그라데이션용)
 * @param {HourChunksMap|undefined|null} dayMap
 * @returns {string[]} 길이 0~2
 */
export function computeTopTwoEmotionIds(dayMap) {
  const tallies = tallyEmotionsForDay(dayMap);
  const ids = Object.keys(tallies);
  if (ids.length === 0) return [];
  ids.sort((a, b) => tallies[b] - tallies[a]);
  return ids.slice(0, 2);
}

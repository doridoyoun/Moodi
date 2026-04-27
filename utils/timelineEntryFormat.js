import { moodPalette, timelineSlotOverrides } from '../constants/theme';

/** Stored memo: first line = title, rest = content */
export function splitMemo(memo) {
  const raw = typeof memo === 'string' ? memo : '';
  if (!raw.trim()) return { title: '', content: '' };
  const nl = raw.indexOf('\n');
  if (nl === -1) return { title: raw.trim(), content: '' };
  return {
    title: raw.slice(0, nl).trim(),
    content: raw.slice(nl + 1).trim(),
  };
}

export function joinMemo(title, content) {
  const t = (title || '').trim();
  const c = (content || '').trim();
  if (!t && !c) return '';
  if (!c) return t;
  if (!t) return c;
  return `${t}\n${c}`;
}

export function formatEntryTime(iso) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatEntryDisplayTime(entry) {
  if (!entry) return '';
  if (entry.minuteUnknown === true) {
    const h = typeof entry?.hour === 'number' ? entry.hour : typeof entry?.timelineHour === 'number' ? entry.timelineHour : null;
    if (typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 23) return `${String(Math.floor(h)).padStart(2, '0')}:--`;
  }
  if (typeof entry?.createdAt === 'string') return formatEntryTime(entry.createdAt);
  return '';
}

export function paletteFor(emotionId) {
  const base = moodPalette[emotionId] ? { ...moodPalette[emotionId] } : { ...moodPalette.happy };
  const o = timelineSlotOverrides[emotionId];
  if (o?.bg) base.bg = o.bg;
  if (o?.border) base.border = o.border;
  return base;
}

export function countTitledMemos(entriesList) {
  let n = 0;
  for (const e of entriesList) {
    const { title } = splitMemo(e.memo);
    if ((title || '').trim()) n += 1;
  }
  return n;
}

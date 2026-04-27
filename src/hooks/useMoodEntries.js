import { useCallback } from 'react';
import {
  addDaysToDateKey,
  createMoodEntry,
  getEntriesForDate,
  getEntriesForDateHour,
  getEntryTimelineDateKey,
  parseDateKey,
  rebuildMoodEntry,
  toDateKey,
} from '../../storage/timelineStateStorage';

export function useMoodEntries({ entries, setEntries, selectedDate, setSelectedDate }) {
  const getEntriesForSelectedDate = useCallback(() => {
    return getEntriesForDate(entries, selectedDate);
  }, [entries, selectedDate]);

  const getEntriesForHour = useCallback(
    (hour) => {
      return getEntriesForDateHour(entries, selectedDate, hour);
    },
    [entries, selectedDate],
  );

  const shiftSelectedDateByDays = useCallback((delta) => {
    setSelectedDate((prev) => addDaysToDateKey(prev, delta));
  }, [setSelectedDate]);

  const createEntry = useCallback(({ emotionId, memo = '', dateKey, hour, imageUri } = {}) => {
    const p = parseDateKey(dateKey);
    if (!p) return null;
    const todayKey = toDateKey(new Date());
    const nowHour = new Date().getHours();
    const minuteUnknown =
      typeof hour === 'number' && Number.isFinite(hour)
        ? !(dateKey === todayKey && Math.floor(hour) === nowHour)
        : false;
    const input = {
      emotionId,
      memo: typeof memo === 'string' ? memo : '',
      createdAt: new Date().toISOString(),
      timelineDateKey: dateKey,
      timelineHour: hour,
      ...(minuteUnknown ? { minuteUnknown: true } : {}),
    };
    if (typeof imageUri === 'string' && imageUri.trim().length > 0) {
      input.imageUri = imageUri.trim();
    }
    const entry = createMoodEntry(input);
    setEntries((prev) =>
      [...prev, entry].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
    return entry;
  }, [setEntries]);

  const updateEntry = useCallback((id, updates) => {
    setEntries((prev) =>
      prev
        .map((e) => {
          if (e.id !== id) return e;
          return rebuildMoodEntry(e, updates);
        })
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
  }, [setEntries]);

  // Back-compat: old signature (entryId, dateKey, enabled:boolean) and new signature (dateKey, entryId).
  const setRepresentativeOverrideForDate = useCallback((a, b, c) => {
    const enabled = typeof c === 'boolean' ? c : true;
    const dateKey = typeof c === 'boolean' ? b : a;
    const entryId = typeof c === 'boolean' ? a : b;

    if (typeof dateKey !== 'string' || !parseDateKey(dateKey)) return;
    if (typeof entryId !== 'string' || entryId.trim().length === 0) return;

    setEntries((prev) => {
      const next = prev.map((e) => {
        if (getEntryTimelineDateKey(e) !== dateKey) return e;
        if (enabled) {
          if (e.id === entryId) {
            return rebuildMoodEntry(e, {
              isRepresentativeOverride: true,
              representativeOverrideAt: new Date().toISOString(),
            });
          }
          if (e.isRepresentativeOverride) {
            return rebuildMoodEntry(e, { isRepresentativeOverride: false });
          }
          return e;
        }
        if (e.id === entryId && e.isRepresentativeOverride) {
          return rebuildMoodEntry(e, { isRepresentativeOverride: false });
        }
        return e;
      });
      return next.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    });
  }, [setEntries]);

  const deleteEntry = useCallback(
    (id) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [setEntries],
  );

  const applyEmotionForCurrentHour = useCallback(
    (emotionId) => {
      const todayKey = toDateKey(new Date());
      const hour = new Date().getHours();
      createEntry({ emotionId, memo: '', dateKey: todayKey, hour });
    },
    [createEntry],
  );

  return {
    getEntriesForSelectedDate,
    getEntriesForHour,
    shiftSelectedDateByDays,
    createEntry,
    updateEntry,
    deleteEntry,
    applyEmotionForCurrentHour,
    setRepresentativeOverrideForDate,
  };
}

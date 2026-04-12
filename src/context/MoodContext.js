import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  addDaysToDateKey,
  buildLegacyTimelineByDateFromEntries,
  createMoodEntry,
  getEntriesForDate,
  getEntriesForDateHour,
  normalizeMoodEntries,
  parseDateKey,
  toDateKey,
} from '../../storage/timelineStateStorage';
import { loadMoodPersistedState, saveMoodPersistedState } from '../../storage/appMoodStorage';

const CHUNKS = 6;

const MoodContext = createContext(null);

function deriveTimelineAnchorFromTimestamp(iso) {
  const d = new Date(iso);
  const dateKey = toDateKey(d);
  const hour = d.getHours();
  const chunk = Math.min(CHUNKS - 1, Math.floor(d.getMinutes() / 10));
  return { dateKey, hour, chunk };
}

export function MoodProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [albumItems, setAlbumItems] = useState([]);
  const [fourSlotIds, setFourSlotIds] = useState([null, null, null, null]);
  const [moodiDaySummary, setMoodiDaySummary] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const hydrated = useRef(false);

  const timelineByDate = useMemo(() => buildLegacyTimelineByDateFromEntries(entries), [entries]);

  const getEntriesForSelectedDate = useCallback(() => {
    return getEntriesForDate(entries, selectedDate);
  }, [entries, selectedDate]);

  const getEntriesForHour = useCallback(
    (hour) => {
      return getEntriesForDateHour(entries, selectedDate, hour);
    },
    [entries, selectedDate],
  );

  useEffect(() => {
    let cancelled = false;
    loadMoodPersistedState().then((data) => {
      if (cancelled) return;
      setEntries(normalizeMoodEntries(data.entries));
      setAlbumItems(data.albumItems);
      setFourSlotIds(data.fourSlotIds);
      setMoodiDaySummary(data.moodiDaySummary ?? '');
      hydrated.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      saveMoodPersistedState({
        entries,
        albumItems,
        fourSlotIds,
        moodiDaySummary,
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [entries, albumItems, fourSlotIds, moodiDaySummary]);

  const shiftSelectedDateByDays = useCallback((delta) => {
    setSelectedDate((prev) => addDaysToDateKey(prev, delta));
  }, []);

  const createEntry = useCallback(({ emotionId, memo = '', dateKey, hour }) => {
    const p = parseDateKey(dateKey);
    if (!p) return null;
    const now = new Date();
    const d = new Date(
      p.year,
      p.monthIndex,
      p.day,
      hour,
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );
    const entry = createMoodEntry({
      emotionId,
      memo: typeof memo === 'string' ? memo : '',
      createdAt: d.toISOString(),
    });
    setEntries((prev) =>
      [...prev, entry].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
    return entry;
  }, []);

  const updateEntry = useCallback((id, updates) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const emotionId = updates.emotionId !== undefined ? updates.emotionId : e.emotionId;
        const memo = updates.memo !== undefined ? String(updates.memo).trim() : e.memo;
        return createMoodEntry({
          id: e.id,
          emotionId,
          memo,
          createdAt: e.createdAt,
        });
      }),
    );
  }, []);

  const deleteEntry = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const applyEmotionForCurrentHour = useCallback((emotionId) => {
    const todayKey = toDateKey(new Date());
    const hour = new Date().getHours();
    createEntry({ emotionId, memo: '', dateKey: todayKey, hour });
  }, [createEntry]);

  const addAlbumItem = useCallback(({ imageUri, emotionId, memo }) => {
    const timestamp = new Date().toISOString();
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const timelineAnchor = deriveTimelineAnchorFromTimestamp(timestamp);
    const entry = createMoodEntry({
      emotionId,
      memo: (memo || '').trim(),
      createdAt: timestamp,
    });
    const item = {
      id,
      imageUri,
      emotionId,
      memo: (memo || '').trim(),
      timestamp,
      timelineAnchor,
      moodEntryId: entry.id,
    };

    setEntries((prev) =>
      [...prev, entry].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
    setAlbumItems((prev) => [item, ...prev]);

    return item;
  }, []);

  const updateAlbumItem = useCallback((id, updates) => {
    setAlbumItems((prevItems) => {
      const idx = prevItems.findIndex((x) => x.id === id);
      if (idx < 0) return prevItems;
      const prevItem = prevItems[idx];
      const nextItem = {
        ...prevItem,
        emotionId: updates.emotionId ?? prevItem.emotionId,
        memo: updates.memo !== undefined ? String(updates.memo).trim() : prevItem.memo,
        timelineAnchor: prevItem.timelineAnchor ?? deriveTimelineAnchorFromTimestamp(prevItem.timestamp),
      };

      setEntries((ent) => {
        let eid = nextItem.moodEntryId;
        if (!eid && prevItem.timestamp) {
          eid = ent.find((e) => e.createdAt === prevItem.timestamp)?.id;
        }
        if (!eid) return ent;
        return ent.map((e) => {
          if (e.id !== eid) return e;
          return createMoodEntry({
            id: e.id,
            emotionId: nextItem.emotionId,
            memo: nextItem.memo,
            createdAt: e.createdAt,
          });
        });
      });

      return prevItems.map((x, j) => (j === idx ? nextItem : x));
    });
  }, []);

  const deleteAlbumItem = useCallback((albumId) => {
    setAlbumItems((prevItems) => {
      const item = prevItems.find((x) => x.id === albumId);
      if (item) {
        if (item.moodEntryId) {
          setEntries((prev) => prev.filter((e) => e.id !== item.moodEntryId));
        } else {
          setEntries((prev) => prev.filter((e) => e.createdAt !== item.timestamp));
        }
      }
      return prevItems.filter((x) => x.id !== albumId);
    });
    setFourSlotIds((prev) => prev.map((sid) => (sid === albumId ? null : sid)));
  }, []);

  const setFourSlotAt = useCallback((index, albumId) => {
    setFourSlotIds((prev) => {
      const next = [...prev];
      next[index] = albumId;
      return next;
    });
  }, []);

  const clearAllFourSlots = useCallback(() => {
    setFourSlotIds([null, null, null, null]);
  }, []);

  const value = useMemo(
    () => ({
      entries,
      timelineByDate,
      selectedDate,
      setSelectedDate,
      shiftSelectedDateByDays,
      getEntriesForSelectedDate,
      getEntriesForHour,
      createEntry,
      updateEntry,
      deleteEntry,
      applyEmotionForCurrentHour,
      albumItems,
      addAlbumItem,
      updateAlbumItem,
      deleteAlbumItem,
      fourSlotIds,
      setFourSlotAt,
      clearAllFourSlots,
      moodiDaySummary,
      setMoodiDaySummary,
    }),
    [
      entries,
      timelineByDate,
      selectedDate,
      shiftSelectedDateByDays,
      getEntriesForSelectedDate,
      getEntriesForHour,
      createEntry,
      updateEntry,
      deleteEntry,
      applyEmotionForCurrentHour,
      albumItems,
      addAlbumItem,
      updateAlbumItem,
      deleteAlbumItem,
      fourSlotIds,
      setFourSlotAt,
      clearAllFourSlots,
      moodiDaySummary,
    ],
  );

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

export function useMood() {
  const ctx = useContext(MoodContext);
  if (!ctx) {
    throw new Error('useMood must be used within MoodProvider');
  }
  return ctx;
}

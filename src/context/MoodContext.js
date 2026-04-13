import React, { createContext, useContext, useMemo, useState } from 'react';
import { toDateKey } from '../../storage/timelineStateStorage';
import { buildLegacyTimelineByDateFromEntries } from '../domain/mood/legacyTimelineBridge';
import { useEmotionToastFlow } from '../hooks/useEmotionToastFlow';
import { useGalleryByDate } from '../hooks/useGalleryByDate';
import { useMoodEntries } from '../hooks/useMoodEntries';
import { useMoodPersistence } from '../hooks/useMoodPersistence';

const MoodContext = createContext(null);

/**
 * Composes persistence, entries, per-day gallery/album, toast flow, and legacy `timelineByDate` bridge.
 * Business logic lives in `src/hooks` and `src/domain/mood`; this file wires state and the public `useMood()` API.
 */
export function MoodProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [albumItems, setAlbumItems] = useState([]);
  const [galleryByDate, setGalleryByDate] = useState({});
  const [emotionToastByDate, setEmotionToastByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));

  useMoodPersistence({
    entries,
    albumItems,
    galleryByDate,
    emotionToastByDate,
    setEntries,
    setAlbumItems,
    setGalleryByDate,
    setEmotionToastByDate,
  });

  const timelineByDate = useMemo(() => buildLegacyTimelineByDateFromEntries(entries), [entries]);

  const {
    getEntriesForSelectedDate,
    getEntriesForHour,
    shiftSelectedDateByDays,
    createEntry,
    updateEntry,
    deleteEntry,
    applyEmotionForCurrentHour,
  } = useMoodEntries({ entries, setEntries, selectedDate, setSelectedDate });

  const {
    fourSlotIds,
    moodiDaySummary,
    innerFrameColorKey,
    addAlbumItem,
    updateAlbumItem,
    deleteAlbumItem,
    setFourSlotAt,
    clearAllFourSlots,
    setMoodiDaySummary,
    setInnerFrameColorKey,
  } = useGalleryByDate({
    entries,
    setEntries,
    albumItems,
    setAlbumItems,
    galleryByDate,
    setGalleryByDate,
    selectedDate,
  });

  const { registerEmotionToastAfterLog } = useEmotionToastFlow({ setEmotionToastByDate });

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
      galleryByDate,
      addAlbumItem,
      updateAlbumItem,
      deleteAlbumItem,
      fourSlotIds,
      setFourSlotAt,
      clearAllFourSlots,
      moodiDaySummary,
      setMoodiDaySummary,
      innerFrameColorKey,
      setInnerFrameColorKey,
      registerEmotionToastAfterLog,
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
      galleryByDate,
      addAlbumItem,
      updateAlbumItem,
      deleteAlbumItem,
      fourSlotIds,
      setFourSlotAt,
      clearAllFourSlots,
      moodiDaySummary,
      setMoodiDaySummary,
      innerFrameColorKey,
      setInnerFrameColorKey,
      registerEmotionToastAfterLog,
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

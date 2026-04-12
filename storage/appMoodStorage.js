import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadGalleryState } from './galleryStateStorage';
import {
  loadTimelineByDate,
  migrateLegacyTimelineByDateToEntries,
  normalizeMoodEntries,
} from './timelineStateStorage';

const UNIFIED_KEY_V2 = 'moodi_unified_state_v2';
const UNIFIED_KEY_V1 = 'moodi_unified_state_v1';

const EMPTY_FOUR = [null, null, null, null];

function safeAlbumItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((it) => {
    if (!it || typeof it !== 'object') {
      return {
        id: `g-${Date.now()}`,
        imageUri: '',
        emotionId: 'happy',
        memo: '',
        timestamp: new Date().toISOString(),
      };
    }
    let timestamp = it.timestamp;
    if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
      timestamp = new Date().toISOString();
    }
    return {
      id: typeof it.id === 'string' ? it.id : `g-${Date.now()}`,
      imageUri: typeof it.imageUri === 'string' ? it.imageUri : '',
      emotionId: typeof it.emotionId === 'string' ? it.emotionId : 'happy',
      memo: typeof it.memo === 'string' ? it.memo : '',
      timestamp,
      ...(it.timelineAnchor && typeof it.timelineAnchor === 'object' ? { timelineAnchor: it.timelineAnchor } : {}),
    };
  });
}

function safeFour(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return [...EMPTY_FOUR];
  return [...arr];
}

/**
 * @returns {Promise<{ entries: object[], albumItems: object[], fourSlotIds: (string|null)[], moodiDaySummary: string }>}
 */
export async function loadMoodPersistedState() {
  try {
    const rawV2 = await AsyncStorage.getItem(UNIFIED_KEY_V2);
    if (rawV2) {
      const p = JSON.parse(rawV2);
      const entries = normalizeMoodEntries(p.entries);
      return {
        entries,
        albumItems: safeAlbumItems(p.albumItems),
        fourSlotIds: safeFour(p.fourSlotIds),
        moodiDaySummary: typeof p.moodiDaySummary === 'string' ? p.moodiDaySummary : '',
      };
    }
  } catch {
    /* fall through */
  }

  try {
    const rawV1 = await AsyncStorage.getItem(UNIFIED_KEY_V1);
    if (rawV1) {
      const p = JSON.parse(rawV1);
      let entries = [];
      if (Array.isArray(p.entries) && p.entries.length > 0) {
        entries = normalizeMoodEntries(p.entries);
      } else if (p.timelineByDate && typeof p.timelineByDate === 'object') {
        entries = migrateLegacyTimelineByDateToEntries(p.timelineByDate);
      }
      return {
        entries,
        albumItems: safeAlbumItems(p.albumItems),
        fourSlotIds: safeFour(p.fourSlotIds),
        moodiDaySummary: typeof p.moodiDaySummary === 'string' ? p.moodiDaySummary : '',
      };
    }
  } catch {
    /* fall through */
  }

  const [timelineByDate, gallery] = await Promise.all([loadTimelineByDate(), loadGalleryState()]);

  const entries = migrateLegacyTimelineByDateToEntries(
    timelineByDate && typeof timelineByDate === 'object' ? timelineByDate : {},
  );

  const migratedAlbum = safeAlbumItems(gallery.albumItems || []);

  return {
    entries,
    albumItems: migratedAlbum,
    fourSlotIds: safeFour(gallery.fourSlotIds),
    moodiDaySummary: '',
  };
}

/**
 * @param {{ entries: object[], albumItems: object[], fourSlotIds: (string|null)[], moodiDaySummary: string }} state
 */
export async function saveMoodPersistedState(state) {
  const normalizedEntries = normalizeMoodEntries(state.entries || []);
  const safeAlbum = safeAlbumItems(state.albumItems || []);
  const four = safeFour(state.fourSlotIds);
  const summary = typeof state.moodiDaySummary === 'string' ? state.moodiDaySummary : '';

  await AsyncStorage.setItem(
    UNIFIED_KEY_V2,
    JSON.stringify({
      entries: normalizedEntries,
      albumItems: safeAlbum,
      fourSlotIds: four,
      moodiDaySummary: summary,
    }),
  );
}

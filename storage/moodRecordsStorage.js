import AsyncStorage from '@react-native-async-storage/async-storage';

const MOOD_RECORDS_KEY = 'moodi_mood_records_v1';

/**
 * @typedef {Object} MoodPhotoRecord
 * @property {string} id
 * @property {string} timestamp ISO
 * @property {string} emotionId
 * @property {string} memo
 * @property {string} imageUri
 */

export async function getAllMoodRecords() {
  try {
    const raw = await AsyncStorage.getItem(MOOD_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** imageUri가 있는 기록만 (앨범용) */
export async function getPhotoMoodRecords() {
  const all = await getAllMoodRecords();
  return all.filter((r) => r && typeof r.imageUri === 'string' && r.imageUri.length > 0);
}

/**
 * @param {Omit<MoodPhotoRecord, 'id'>[]} items
 */
export async function appendMoodRecords(items) {
  const all = await getAllMoodRecords();
  const withIds = items.map((item, i) => ({
    ...item,
    id: item.id ?? `m-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
  }));
  const next = [...all, ...withIds];
  await AsyncStorage.setItem(MOOD_RECORDS_KEY, JSON.stringify(next));
  return withIds;
}

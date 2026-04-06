import AsyncStorage from '@react-native-async-storage/async-storage';

/** @type {string} 나중에 스키마 변경 시 버전 키만 올리면 됨 */
export const GALLERY_STATE_KEY = 'moodi_gallery_state_v1';

/**
 * @typedef {Object} GalleryAlbumItem
 * @property {string} id
 * @property {string} imageUri
 * @property {string} emotionColor  감정 테두리/글로우용 hex
 * @property {string} timestamp ISO
 */

/**
 * @returns {Promise<{ albumItems: GalleryAlbumItem[], fourSlotIds: (string|null)[] }>}
 */
export async function loadGalleryState() {
  try {
    const raw = await AsyncStorage.getItem(GALLERY_STATE_KEY);
    if (!raw) {
      return {
        albumItems: [],
        fourSlotIds: [null, null, null, null],
      };
    }
    const parsed = JSON.parse(raw);
    return {
      albumItems: Array.isArray(parsed.albumItems) ? parsed.albumItems : [],
      fourSlotIds:
        Array.isArray(parsed.fourSlotIds) && parsed.fourSlotIds.length === 4
          ? parsed.fourSlotIds
          : [null, null, null, null],
    };
  } catch {
    return {
      albumItems: [],
      fourSlotIds: [null, null, null, null],
    };
  }
}

/**
 * @param {{ albumItems: GalleryAlbumItem[], fourSlotIds: (string|null)[] }} state
 */
export async function saveGalleryState(state) {
  await AsyncStorage.setItem(GALLERY_STATE_KEY, JSON.stringify(state));
}

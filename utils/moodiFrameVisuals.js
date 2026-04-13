import { moodPalette, notebook } from '../constants/theme';

function parseHexRgb(hex) {
  const h = (hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function relativeLuminanceHex(hex) {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 1;
  const lin = (x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(rgb.r);
  const G = lin(rgb.g);
  const B = lin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function isDarkFrameBackground(hex) {
  return relativeLuminanceHex(hex) < 0.45;
}

export function innerFrameBgForKey(key) {
  if (key === 'white') return '#FFFFFF';
  if (key === 'black') return '#1a1a1a';
  return moodPalette[key]?.bg ?? '#FFFFFF';
}

/**
 * Same frame colors / slot wells as the main Gallery Moodi canvas (`getFrameVisuals` in GalleryScreen).
 * @param {string} innerFrameKey
 */
export function getMoodiFrameVisuals(innerFrameKey) {
  const frameBg = innerFrameBgForKey(innerFrameKey);
  const isDark = isDarkFrameBackground(frameBg);
  const frameBorder = isDark ? 'rgba(255,255,255,0.28)' : '#E8E1D5';
  const titleColor = isDark ? '#f5f5f5' : notebook.ink;
  const memoHex = isDark ? '#ececec' : '#555555';
  const placeholderColor = isDark ? 'rgba(245,245,245,0.4)' : 'rgba(85, 85, 85, 0.42)';
  const dateColor = isDark ? 'rgba(255,255,255,0.65)' : notebook.inkLight;
  const brandColor = isDark ? 'rgba(255,255,255,0.55)' : notebook.inkLight;
  const slotEmptyBg = isDark ? 'rgba(255,255,255,0.12)' : '#FCFBF8';
  const slotEmptyBorder = isDark ? 'rgba(255,255,255,0.48)' : '#C9C2B6';
  const photoWellBg = isDark ? '#262628' : '#FCFBF8';
  return {
    frameBg,
    frameBorder,
    isDark,
    titleColor,
    memoHex,
    placeholderColor,
    dateColor,
    brandColor,
    brandOpacity: isDark ? 0.78 : 0.65,
    titleOpacity: 0.92,
    slotEmptyBg,
    slotEmptyBorder,
    photoWellBg,
  };
}

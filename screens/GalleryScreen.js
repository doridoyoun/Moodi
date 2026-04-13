import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  CloudRain,
  Download,
  Flame,
  Heart,
  Leaf,
  Smile,
} from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import NotebookLayout from '../components/NotebookLayout';
import { useMemoFont } from '../src/context/MemoFontContext';
import { useMood } from '../src/context/MoodContext';
import { moodOrder, moodPalette, notebook } from '../constants/theme';
import { formatDateKeyForDisplay, parseDateKey, toDateKey } from '../storage/timelineStateStorage';

const modalEmotionIcons = {
  happy: Smile,
  flutter: Heart,
  calm: Leaf,
  gloom: CloudRain,
  annoyed: Flame,
};

function formatMoodiCanvasDate() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

function canvasDateLabelForDateKey(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return formatMoodiCanvasDate();
  return new Date(p.year, p.monthIndex, p.day).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

function handwrittenInkShadowForHex(hex) {
  const h = (hex || '').trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(h)) {
    return {
      textShadowColor: 'rgba(28, 28, 28, 0.75)',
      textShadowOffset: { width: 0.4, height: 0.4 },
      textShadowRadius: 0.5,
    };
  }
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const t = 0.62;
  return {
    textShadowColor: `rgba(${Math.round(r * t)}, ${Math.round(g * t)}, ${Math.round(b * t)}, 0.76)`,
    textShadowOffset: { width: 0.4, height: 0.4 },
    textShadowRadius: 0.5,
  };
}

function handwrittenMemoCoreStyles(inkHex, memoFontFamily) {
  return {
    color: inkHex,
    ...handwrittenInkShadowForHex(inkHex),
    ...(memoFontFamily ? { fontFamily: memoFontFamily } : {}),
  };
}

/** Outer Gallery card only — neutral gray, separates from inner white frame */
const OUTER_CARD_BACKGROUND = '#E5E5E5';

/** Portrait slot: width : height = 3 : 4 */
const MOODI_SLOT_ASPECT = 3 / 4;

const INNER_FRAME_COLOR_KEYS = ['white', 'black', 'happy', 'flutter', 'calm', 'gloom', 'annoyed'];

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

function innerFrameBgForKey(key) {
  if (key === 'white') return '#FFFFFF';
  if (key === 'black') return '#1a1a1a';
  return moodPalette[key]?.bg ?? '#FFFFFF';
}

function chipFillForKey(key) {
  return innerFrameBgForKey(key);
}

function getFrameVisuals(innerFrameKey) {
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

const MOBILE_GRID_GAP = 8;

/** Viewports below this use compact spacing, capped slot height, and extra scroll bottom inset. */
const GALLERY_COMPACT_MAX_WIDTH = 600;

const moodiCanvasStyles = StyleSheet.create({
  canvas: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  canvasFlex: {
    flex: 1,
    minHeight: 0,
  },
  /** Vertical centering for unified grid block inside flex canvas */
  gridBlockCenter: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasTitle: {
    width: '100%',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.35,
    marginBottom: 9,
  },
  gridWrap: {
    width: '100%',
    marginBottom: 2,
  },
  gridRow: {
    flexDirection: 'row',
    width: '100%',
  },
  slotOuter: {
    minWidth: 0,
  },
  /** Equal columns when slot size not fixed (legacy) */
  slotOuterFlex: {
    flex: 1,
  },
  slotFrame: {
    width: '100%',
    borderRadius: 8,
    /** Thinner stroke so photos read larger inside the same cell */
    borderWidth: 1,
    overflow: 'hidden',
  },
  slotImg: {
    width: '100%',
    height: '100%',
  },
  slotEmpty: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    position: 'relative',
  },
  slotPlusOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotPlusText: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(0, 0, 0, 0.4)',
  },
  slotPlusTextOnDark: {
    color: 'rgba(255, 255, 255, 0.48)',
  },
  summaryBlock: {
    width: '100%',
    marginTop: 11,
    marginBottom: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  summaryTextExport: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.12,
  },
  /** Display-only summary on Gallery (tap opens memo modal) */
  summaryDisplay: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    minHeight: 42,
  },
  summaryPressable: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerMeta: {
    width: '100%',
    alignItems: 'center',
    gap: 0,
    paddingTop: 0,
    marginTop: 1,
  },
  canvasDate: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  canvasBrand: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.9,
  },
});

function MoodiSlotPhoto({
  item,
  onPress,
  photoWellBg,
  slotEmptyBg,
  slotEmptyBorder,
  suppressEmptyPlus,
  frameIsDark,
  /** Fixed pixel size (export capture); omit for flex or aspect layout */
  slotSize,
  /** Gallery fitted layout: slot grows in row, height capped */
  flexMode,
  slotMaxHeight,
}) {
  const eid = item?.emotionId || 'happy';
  const pal = moodPalette[eid] ?? moodPalette.happy;

  const maxH = slotMaxHeight ?? 160;
  const fixedSlotStyle = slotSize
    ? { width: slotSize.width, height: slotSize.height }
    : flexMode
      ? { width: '100%', aspectRatio: MOODI_SLOT_ASPECT, maxHeight: maxH }
      : { width: '100%', aspectRatio: MOODI_SLOT_ASPECT };
  /** Fixed four-cut cells: outer box matches slot exactly (no flex distortion). */
  const slotOuterBox = slotSize
    ? { width: slotSize.width, height: slotSize.height }
    : null;
  const slotOuterFlexMode =
    flexMode && !slotSize
      ? { flex: 1, minWidth: 0, justifyContent: 'center', alignItems: 'center' }
      : null;
  const slotOuterCenter = slotSize ? { alignItems: 'center' } : null;

  const renderEmptySlot = (pressed) => (
    <View
      style={[
        moodiCanvasStyles.slotEmpty,
        fixedSlotStyle,
        { backgroundColor: slotEmptyBg, borderColor: slotEmptyBorder },
      ]}
    >
      {!suppressEmptyPlus && (
        <View style={moodiCanvasStyles.slotPlusOverlay} pointerEvents="none">
          <Text
            style={[
              moodiCanvasStyles.slotPlusText,
              frameIsDark && moodiCanvasStyles.slotPlusTextOnDark,
              pressed && { transform: [{ scale: 1.2 }] },
            ]}
          >
            +
          </Text>
        </View>
      )}
    </View>
  );

  if (item) {
    const filled = (
      <View
        style={[
          moodiCanvasStyles.slotFrame,
          fixedSlotStyle,
          { borderColor: pal.border, backgroundColor: photoWellBg },
        ]}
      >
        <Image source={{ uri: item.imageUri }} style={moodiCanvasStyles.slotImg} resizeMode="cover" />
      </View>
    );
    if (!onPress) {
      return (
        <View
          style={[
            moodiCanvasStyles.slotOuter,
            !slotSize && moodiCanvasStyles.slotOuterFlex,
            slotOuterBox,
            slotOuterFlexMode,
            slotOuterCenter,
          ]}
        >
          {filled}
        </View>
      );
    }
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          moodiCanvasStyles.slotOuter,
          !slotSize && moodiCanvasStyles.slotOuterFlex,
          slotOuterBox,
          slotOuterFlexMode,
          slotOuterCenter,
          pressed && { opacity: 0.92 },
        ]}
      >
        {filled}
      </Pressable>
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          moodiCanvasStyles.slotOuter,
          !slotSize && moodiCanvasStyles.slotOuterFlex,
          slotOuterBox,
          slotOuterFlexMode,
          slotOuterCenter,
          pressed && { opacity: 0.92 },
        ]}
      >
        {({ pressed }) => renderEmptySlot(pressed)}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        moodiCanvasStyles.slotOuter,
        !slotSize && moodiCanvasStyles.slotOuterFlex,
        slotOuterBox,
        slotOuterFlexMode,
        slotOuterCenter,
      ]}
    >
      {renderEmptySlot(false)}
    </View>
  );
}

function TodaysMoodiCanvas({
  slots,
  summaryText,
  isExport,
  isExporting,
  onSlotPress,
  /** Opens memo edit modal from Gallery */
  onSummaryPress,
  frameVisuals,
  gridGap = MOBILE_GRID_GAP,
  /** Per-screen metrics from Gallery (spacing + unified slot dimensions) */
  layoutMetrics,
  /** Footer date line (defaults to “today” if omitted) */
  canvasDateText,
}) {
  const { memoFontFamily } = useMemoFont();
  const fv = frameVisuals ?? getFrameVisuals('white');
  const summaryHandwritten = handwrittenMemoCoreStyles(fv.memoHex, memoFontFamily);

  const suppressEmptyPlus = Boolean(isExport) || Boolean(isExporting);

  const slotSize =
    layoutMetrics?.useCompactSlots && layoutMetrics.slotW > 0 && layoutMetrics.slotH > 0
      ? { width: layoutMetrics.slotW, height: layoutMetrics.slotH }
      : undefined;

  /** Main Gallery: flex canvas + vertically centered unified grid (export uses natural height). */
  const fillCanvas = !isExport && Boolean(slotSize);

  const slotProps = {
    photoWellBg: fv.photoWellBg,
    slotEmptyBg: fv.slotEmptyBg,
    slotEmptyBorder: fv.slotEmptyBorder,
    suppressEmptyPlus,
    frameIsDark: fv.isDark,
    slotSize,
    flexMode: false,
    slotMaxHeight: layoutMetrics?.slotMaxHeight ?? 160,
  };

  const g = layoutMetrics?.gridGap ?? gridGap;
  const rowStyle = { flexDirection: 'row', gap: g };
  const gridBlockW = slotSize ? slotSize.width * 2 + g : undefined;

  const gridTwoByTwo = (
    <View style={gridBlockW != null ? { width: gridBlockW, gap: g } : [moodiCanvasStyles.gridWrap, { gap: g }]}>
      <View style={rowStyle}>
        <MoodiSlotPhoto
          item={slots[0]}
          onPress={onSlotPress ? () => onSlotPress(0) : undefined}
          {...slotProps}
        />
        <MoodiSlotPhoto
          item={slots[1]}
          onPress={onSlotPress ? () => onSlotPress(1) : undefined}
          {...slotProps}
        />
      </View>
      <View style={rowStyle}>
        <MoodiSlotPhoto
          item={slots[2]}
          onPress={onSlotPress ? () => onSlotPress(2) : undefined}
          {...slotProps}
        />
        <MoodiSlotPhoto
          item={slots[3]}
          onPress={onSlotPress ? () => onSlotPress(3) : undefined}
          {...slotProps}
        />
      </View>
    </View>
  );

  const canvasPadding = layoutMetrics
    ? {
        paddingTop: layoutMetrics.canvasPadV,
        paddingBottom: layoutMetrics.canvasPadV,
        paddingHorizontal: layoutMetrics.canvasPadH,
      }
    : null;

  return (
    <View
      style={[
        moodiCanvasStyles.canvas,
        fillCanvas && moodiCanvasStyles.canvasFlex,
        { backgroundColor: fv.frameBg, borderColor: fv.frameBorder },
        canvasPadding,
      ]}
      collapsable={false}
    >
      <Text
        style={[
          moodiCanvasStyles.canvasTitle,
          { color: fv.titleColor, opacity: fv.titleOpacity },
          layoutMetrics != null && { marginBottom: layoutMetrics.canvasTitleMb },
        ]}
      >
        {'Today\u2019s Moodi'}
      </Text>
      {fillCanvas ? (
        <View style={moodiCanvasStyles.gridBlockCenter}>{gridTwoByTwo}</View>
      ) : (
        gridTwoByTwo
      )}
      <View
        style={[
          moodiCanvasStyles.summaryBlock,
          layoutMetrics != null && {
            marginTop: layoutMetrics.summaryMt,
            marginBottom: layoutMetrics.summaryMb,
          },
        ]}
        collapsable={false}
      >
        {isExport ? (
          <Text style={[moodiCanvasStyles.summaryTextExport, summaryHandwritten]} numberOfLines={1}>
            {summaryText.trim() || ' '}
          </Text>
        ) : (
          <Pressable
            onPress={onSummaryPress}
            style={({ pressed }) => [
              moodiCanvasStyles.summaryPressable,
              pressed && { opacity: 0.88 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="한 줄 메모 편집"
          >
            <Text
              style={[
                moodiCanvasStyles.summaryDisplay,
                summaryHandwritten,
                fillCanvas &&
                  layoutMetrics?.summaryMinHeight != null && {
                    minHeight: layoutMetrics.summaryMinHeight,
                    paddingVertical: 3,
                    paddingHorizontal: 4,
                  },
                !summaryText.trim() && { color: fv.placeholderColor },
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {summaryText.trim() ? summaryText : '오늘 하루를 한 줄로 남겨보세요'}
            </Text>
          </Pressable>
        )}
      </View>
      <View
        style={[
          moodiCanvasStyles.footerMeta,
          layoutMetrics != null && { marginTop: layoutMetrics.footerMt },
        ]}
      >
        <Text style={[moodiCanvasStyles.canvasDate, { color: fv.dateColor }]}>
          {canvasDateText ?? formatMoodiCanvasDate()}
        </Text>
        <Text style={[moodiCanvasStyles.canvasBrand, { color: fv.brandColor, opacity: fv.brandOpacity }]}>
          Moodi
        </Text>
      </View>
    </View>
  );
}

export default function GalleryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { memoFontFamily } = useMemoFont();

  const isGalleryCompact = windowWidth < GALLERY_COMPACT_MAX_WIDTH;

  /** Card width: tighter on real phones; wider on tablet / web. */
  const galleryCardWidth = useMemo(() => {
    const sidePad = isGalleryCompact ? 24 : 32;
    const maxByWidth = Math.min(380, windowWidth - sidePad);
    if (!isGalleryCompact) {
      if (windowHeight < 660) return Math.min(maxByWidth, 280);
      if (windowHeight < 700) return Math.min(maxByWidth, 296);
      if (windowHeight < 740) return Math.min(maxByWidth, 312);
      if (windowHeight < 800) return Math.min(maxByWidth, 330);
      if (windowHeight < 860) return Math.min(maxByWidth, 350);
      return maxByWidth;
    }
    if (windowHeight < 640) return Math.min(maxByWidth, 276);
    if (windowHeight < 720) return Math.min(maxByWidth, 312);
    return Math.min(maxByWidth, 336);
  }, [windowWidth, windowHeight, isGalleryCompact]);

  /** Full-screen fitted Gallery: dense inner frame so the 2×2 block uses more of the card. */
  const galleryFitMetrics = useMemo(
    () => ({
      compact: isGalleryCompact,
      summaryMinHeight: 30,
      outerPad: 6,
      canvasPadH: 4,
      canvasPadV: 5,
      canvasTitleMb: 9,
      gridGap: 8,
      summaryMt: 10,
      summaryMb: 1,
      footerMt: 6,
      titleRowMb: 10,
      galleryBottomMt: 8,
      fourCutTitleRowMt: 8,
    }),
    [isGalleryCompact],
  );

  const [galleryMiddleHeight, setGalleryMiddleHeight] = useState(0);

  const onGalleryMiddleLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setGalleryMiddleHeight(h);
  }, []);

  /** Unified 2×2 slot size: scale whole grid to fit measured card body (identical cells). */
  const galleryFitLayoutMetrics = useMemo(() => {
    const m = galleryFitMetrics;
    const gridGap = m.gridGap;
    const innerW = galleryCardWidth - 2 * m.outerPad - 2 * m.canvasPadH;
    let slotW = Math.max(36, (innerW - gridGap) / 2);
    let slotH = (slotW * 4) / 3;

    const effectiveMiddleH =
      galleryMiddleHeight > 40 ? galleryMiddleHeight : windowHeight * 0.52;

    const actionRowH = 44;
    const innerCardH = Math.max(0, effectiveMiddleH - 2 * m.outerPad);
    const moodiCanvasMaxH = innerCardH - actionRowH;

    const canvasTitleH = 22 + m.canvasTitleMb;
    const summaryBlockH = m.summaryMt + 36 + m.summaryMb;
    const footerBlockH = m.footerMt + 22;
    const canvasPadV = m.canvasPadV * 2;
    const reserved = canvasTitleH + summaryBlockH + footerBlockH + canvasPadV + 6;
    const gridMaxH = Math.max(72, moodiCanvasMaxH - reserved);

    const naturalGridH = 2 * slotH + gridGap;
    if (naturalGridH > gridMaxH) {
      slotH = Math.max(40, (gridMaxH - gridGap) / 2);
      slotW = Math.min(slotW, (slotH * 3) / 4);
    }

    return {
      ...m,
      useCompactSlots: true,
      slotW: Math.round(slotW * 100) / 100,
      slotH: Math.round(slotH * 100) / 100,
    };
  }, [galleryFitMetrics, galleryCardWidth, galleryMiddleHeight, windowHeight]);

  /** Offscreen export capture: match on-screen card padding so PNG aligns with Gallery. */
  const exportLayoutMetrics = useMemo(() => {
    const outerPad = 6;
    const canvasPadH = 4;
    const canvasPadV = 5;
    const gridGap = 8;
    const innerGridW = galleryCardWidth - 2 * outerPad - 2 * canvasPadH;
    const cellW = Math.max(0, (innerGridW - gridGap) / 2);
    const slotH = (cellW * 4) / 3;
    return {
      useCompactSlots: true,
      slotW: Math.round(cellW * 100) / 100,
      slotH: Math.round(slotH * 100) / 100,
      outerPad,
      canvasPadH,
      canvasPadV,
      canvasTitleMb: 9,
      gridGap,
      summaryMt: 10,
      summaryMb: 1,
      footerMt: 6,
    };
  }, [galleryCardWidth]);

  const pendingSlotForNewAlbumRef = useRef(null);
  const {
    albumItems,
    fourSlotIds,
    setFourSlotAt,
    clearAllFourSlots,
    moodiDaySummary,
    setMoodiDaySummary,
    addAlbumItem,
    selectedDate,
    innerFrameColorKey,
    setInnerFrameColorKey,
  } = useMood();

  const todayKey = toDateKey(new Date());
  const isGalleryDateToday = selectedDate === todayKey;
  const galleryDateLine = useMemo(
    () => formatDateKeyForDisplay(selectedDate, 'ko-KR'),
    [selectedDate],
  );
  const canvasFooterDate = useMemo(() => canvasDateLabelForDateKey(selectedDate), [selectedDate]);

  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState(null);
  const [pickedEmotion, setPickedEmotion] = useState(null);

  const [slotPickerVisible, setSlotPickerVisible] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  const frameVisuals = useMemo(() => getFrameVisuals(innerFrameColorKey), [innerFrameColorKey]);

  const moodiCaptureRef = useRef(null);
  const memoModalInputRef = useRef(null);
  const [savingMoodi, setSavingMoodi] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [memoModalVisible, setMemoModalVisible] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');

  const openMemoModal = useCallback(() => {
    setMemoDraft(moodiDaySummary);
    setMemoModalVisible(true);
  }, [moodiDaySummary]);

  useEffect(() => {
    if (!memoModalVisible) return;
    const t = setTimeout(() => memoModalInputRef.current?.focus?.(), 120);
    return () => clearTimeout(t);
  }, [memoModalVisible]);

  const closeMemoModalDiscard = useCallback(() => {
    setMemoModalVisible(false);
  }, []);

  const saveMemoFromModal = useCallback(() => {
    setMoodiDaySummary(memoDraft.trim());
    setMemoModalVisible(false);
  }, [memoDraft, setMoodiDaySummary]);

  const clearPendingSlotAssign = useCallback(() => {
    pendingSlotForNewAlbumRef.current = null;
  }, []);

  const saveTodaysMoodiImage = useCallback(async () => {
    if (savingMoodi) return;
    setSavingMoodi(true);
    setIsExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('알림', '사진을 저장하려면 갤러리 접근을 허용해 주세요.');
        return;
      }
      const node = moodiCaptureRef.current;
      if (!node) {
        Alert.alert('오류', '저장에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      const uri = await captureRef(node, {
        format: 'png',
        quality: 1,
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('저장 완료', '저장이 완료되었습니다');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsExporting(false);
      setSavingMoodi(false);
    }
  }, [savingMoodi]);

  const beginNewAlbumFromImageUri = useCallback((uri) => {
    setPendingImageUri(uri);
    setPickedEmotion(null);
    setEmotionModalVisible(true);
  }, []);

  const openGalleryForNewAlbum = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      pendingSlotForNewAlbumRef.current = null;
      Alert.alert('알림', '사진을 선택하려면 갤러리 접근을 허용해 주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    });

    if (result.canceled || !result.assets?.[0]) {
      pendingSlotForNewAlbumRef.current = null;
      return;
    }
    beginNewAlbumFromImageUri(result.assets[0].uri);
  }, [beginNewAlbumFromImageUri]);

  const openCameraForNewAlbum = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      pendingSlotForNewAlbumRef.current = null;
      Alert.alert('알림', '사진을 촬영하려면 카메라 접근을 허용해 주세요.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    });

    if (result.canceled || !result.assets?.[0]) {
      pendingSlotForNewAlbumRef.current = null;
      return;
    }
    beginNewAlbumFromImageUri(result.assets[0].uri);
  }, [beginNewAlbumFromImageUri]);

  const openAddPhotoAlert = useCallback(() => {
    Alert.alert('사진 추가', '', [
      { text: '앨범에서 선택', onPress: () => void openGalleryForNewAlbum() },
      { text: '사진 찍기', onPress: () => void openCameraForNewAlbum() },
      { text: '취소', style: 'cancel', onPress: clearPendingSlotAssign },
    ]);
  }, [clearPendingSlotAssign, openCameraForNewAlbum, openGalleryForNewAlbum]);

  const resetEmotionModal = useCallback(() => {
    pendingSlotForNewAlbumRef.current = null;
    setPendingImageUri(null);
    setPickedEmotion(null);
    setEmotionModalVisible(false);
  }, []);

  const submitAlbumEntry = useCallback(() => {
    if (!pickedEmotion) return;
    if (!pendingImageUri) return;
    const slotIdx = pendingSlotForNewAlbumRef.current;
    const item = addAlbumItem({
      imageUri: pendingImageUri,
      emotionId: pickedEmotion,
      memo: '',
    });
    pendingSlotForNewAlbumRef.current = null;
    if (slotIdx !== null && item?.id) {
      setFourSlotAt(slotIdx, item.id);
    }
    resetEmotionModal();
  }, [addAlbumItem, pendingImageUri, pickedEmotion, resetEmotionModal, setFourSlotAt]);

  const openSlotPicker = useCallback(
    (slotIndex) => {
      setActiveSlotIndex(slotIndex);
      if (!fourSlotIds[slotIndex]) {
        pendingSlotForNewAlbumRef.current = slotIndex;
        openAddPhotoAlert();
        return;
      }
      setSlotPickerVisible(true);
    },
    [fourSlotIds, openAddPhotoAlert],
  );

  const selectAlbumForSlot = useCallback(
    (albumId) => {
      setFourSlotAt(activeSlotIndex, albumId);
      setSlotPickerVisible(false);
    },
    [activeSlotIndex, setFourSlotAt],
  );

  const clearActiveSlot = useCallback(() => {
    setFourSlotAt(activeSlotIndex, null);
    setSlotPickerVisible(false);
  }, [activeSlotIndex, setFourSlotAt]);

  const resolveItem = useCallback(
    (id) => albumItems.find((a) => a.id === id),
    [albumItems],
  );

  const confirmClearAllFourSlots = useCallback(() => {
    const hasAny = fourSlotIds.some(Boolean);
    if (!hasAny) return;
    const msg = isGalleryDateToday
      ? '오늘의 Moodi 슬롯을 모두 비울까요?'
      : '이 날짜의 Moodi 슬롯을 모두 비울까요?';
    Alert.alert('네컷 비우기', msg, [
      { text: '취소', style: 'cancel' },
      { text: '비우기', style: 'destructive', onPress: clearAllFourSlots },
    ]);
  }, [clearAllFourSlots, fourSlotIds, isGalleryDateToday]);

  return (
    <NotebookLayout>
      <View style={[styles.galleryRoot, Platform.OS === 'web' && styles.galleryRootWeb]}>
        <View style={styles.galleryFitColumn}>
          <View style={[styles.titleRow, { marginBottom: galleryFitMetrics.titleRowMb }]}>
            <Text style={styles.emoji}>📷</Text>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle}>Mood Gallery</Text>
              <Text style={styles.pageDateHint}>{galleryDateLine}</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('GalleryArchive')}
              hitSlop={8}
              style={({ pressed }) => [styles.archiveBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel="보관함 보기"
            >
              <Text style={styles.archiveBtnText}>보관함 보기</Text>
            </Pressable>
          </View>

          <View style={styles.galleryMiddle} onLayout={onGalleryMiddleLayout}>
            <View
              style={[
                styles.fourCutCard,
                styles.fourCutCardFit,
                {
                  width: galleryCardWidth,
                  alignSelf: 'center',
                  padding: galleryFitMetrics.outerPad,
                },
              ]}
            >
              <View style={styles.moodiCaptureOuterFlex}>
                <TodaysMoodiCanvas
                  slots={fourSlotIds.map((id) => (id ? resolveItem(id) : null))}
                  summaryText={moodiDaySummary}
                  isExport={false}
                  isExporting={isExporting}
                  onSlotPress={openSlotPicker}
                  onSummaryPress={openMemoModal}
                  frameVisuals={frameVisuals}
                  layoutMetrics={galleryFitLayoutMetrics}
                  canvasDateText={canvasFooterDate}
                />
              </View>
              <View style={[styles.fourCutTitleRow, { marginTop: galleryFitMetrics.fourCutTitleRowMt }]}>
                <Pressable
                  onPress={confirmClearAllFourSlots}
                  hitSlop={8}
                  style={({ pressed }) => [styles.clearAllSlotsBtn, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel="네컷 슬롯 전체 비우기"
                >
                  <Text style={styles.clearAllSlotsText}>전체 비우기</Text>
                </Pressable>
                <Pressable
                  onPress={saveTodaysMoodiImage}
                  disabled={savingMoodi}
                  style={({ pressed }) => [
                    styles.saveMoodiBtn,
                    (pressed && !savingMoodi) && { opacity: 0.72 },
                    savingMoodi && { opacity: 0.45 },
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={"Today's Moodi 이미지로 저장"}
                >
                  <Download size={20} color={notebook.inkMuted} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={[styles.galleryBottom, { marginTop: galleryFitMetrics.galleryBottomMt }]}>
            <View style={styles.frameColorPickerWrapper}>
              <View style={styles.frameColorPicker}>
                {INNER_FRAME_COLOR_KEYS.map((key) => {
                  const fill = chipFillForKey(key);
                  const selected = innerFrameColorKey === key;
                  const isLightChip = key === 'white' || relativeLuminanceHex(fill) > 0.7;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setInnerFrameColorKey(key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`프레임 색 ${key}`}
                      style={({ pressed }) => [
                        styles.frameChipOuter,
                        selected && styles.frameChipOuterSelected,
                        pressed && !selected && { opacity: 0.88 },
                      ]}
                    >
                      <View
                        style={[
                          styles.frameChipDot,
                          {
                            backgroundColor: fill,
                            borderColor: isLightChip ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.22)',
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.moodiShareOffscreen} pointerEvents="none">
        <View
          ref={moodiCaptureRef}
          collapsable={false}
          style={[styles.moodiShareCaptureRoot, { width: galleryCardWidth }]}
        >
          <TodaysMoodiCanvas
            slots={fourSlotIds.map((id) => (id ? resolveItem(id) : null))}
            summaryText={moodiDaySummary}
            isExport
            frameVisuals={frameVisuals}
            layoutMetrics={exportLayoutMetrics}
            canvasDateText={canvasFooterDate}
          />
        </View>
      </View>

      <Modal
        visible={memoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMemoModalDiscard}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <Pressable
            style={styles.modalBackdropFixed}
            onPress={closeMemoModalDiscard}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          />
          <View style={styles.modalCardHost} pointerEvents="box-none">
            <Pressable
              style={[styles.memoModalCard, { paddingBottom: insets.bottom + 16 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.memoModalTitle}>한 줄 메모</Text>
              <TextInput
                ref={memoModalInputRef}
                value={memoDraft}
                onChangeText={setMemoDraft}
                placeholder="오늘 하루를 한 줄로 남겨보세요"
                placeholderTextColor={notebook.inkLight}
                maxLength={100}
                multiline
                scrollEnabled
                style={styles.memoModalInput}
                keyboardAppearance="light"
              />
              <View style={styles.memoModalActions}>
                <Pressable
                  onPress={closeMemoModalDiscard}
                  style={({ pressed }) => [styles.memoModalBtn, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel="취소"
                >
                  <Text style={styles.modalCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={saveMemoFromModal}
                  style={({ pressed }) => [styles.memoModalBtn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel="저장"
                >
                  <Text style={styles.memoModalSaveText}>저장</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={emotionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={resetEmotionModal}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdropFixed}
            onPress={resetEmotionModal}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          />
          <View style={styles.modalCardHost} pointerEvents="box-none">
            <Pressable style={styles.emotionModalCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView
                style={styles.emotionModalScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                <EmotionModalBody
                  pickedEmotion={pickedEmotion}
                  setPickedEmotion={setPickedEmotion}
                  submitAlbumEntry={submitAlbumEntry}
                  resetEmotionModal={resetEmotionModal}
                  bottomInset={insets.bottom}
                />
              </ScrollView>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={slotPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSlotPickerVisible(false)}
      >
        <View style={styles.slotModalRoot}>
          <Pressable style={styles.slotModalBackdrop} onPress={() => setSlotPickerVisible(false)} />
          <View style={[styles.slotSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>사진 선택</Text>
            {fourSlotIds[activeSlotIndex] ? (
              <Pressable style={styles.clearSlotBtn} onPress={clearActiveSlot}>
                <Text style={styles.clearSlotBtnText}>이 칸 비우기</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.addAlbumLink, pressed && { opacity: 0.85 }]}
              onPress={() => {
                pendingSlotForNewAlbumRef.current = activeSlotIndex;
                setSlotPickerVisible(false);
                openAddPhotoAlert();
              }}
            >
              <Text style={styles.addAlbumLinkText}>＋ 앨범에 새 사진 추가</Text>
            </Pressable>
            {albumItems.length === 0 ? (
              <Text style={styles.emptyPicker}>앨범에 사진이 없어요</Text>
            ) : (
              <ScrollView
                style={styles.pickerScroll}
                contentContainerStyle={styles.pickerGrid}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.pickerRowWrap}>
                  {albumItems.map((item) => {
                    const eid = item.emotionId || 'happy';
                    const border = moodPalette[eid]?.border ?? moodPalette.happy.border;
                    return (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [
                          styles.pickerThumbWrap,
                          { borderColor: border },
                          pressed && { opacity: 0.9 },
                        ]}
                        onPress={() => selectAlbumForSlot(item.id)}
                      >
                        <Image source={{ uri: item.imageUri }} style={styles.pickerThumb} />
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            <Pressable style={styles.modalCloseBtn} onPress={() => setSlotPickerVisible(false)}>
              <Text style={styles.modalCloseText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </NotebookLayout>
  );
}

function EmotionModalBody({
  pickedEmotion,
  setPickedEmotion,
  submitAlbumEntry,
  resetEmotionModal,
  bottomInset,
}) {
  return (
    <View style={[styles.emotionSheet, { paddingBottom: bottomInset + 16 }]}>
      <Text style={styles.emotionPickerTitle}>감정 선택</Text>
      <View style={styles.emotionPickerRowWrap}>
        <View style={styles.emotionRowModal}>
          {moodOrder.map((id) => {
            const m = moodPalette[id];
            const Icon = modalEmotionIcons[id];
            const selected = pickedEmotion === id;
            return (
              <Pressable
                key={id}
                onPress={() => setPickedEmotion(id)}
                accessibilityLabel={m.label}
                style={({ pressed }) => [
                  styles.emotionCircleBtn,
                  {
                    backgroundColor: m.bg,
                    borderColor: selected ? m.border : 'rgba(15, 23, 42, 0.12)',
                  },
                  selected && styles.emotionCircleBtnSelected,
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Icon size={22} color={m.ink} strokeWidth={selected ? 2.35 : 2} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <Pressable
        onPress={submitAlbumEntry}
        disabled={!pickedEmotion}
        style={({ pressed }) => [
          styles.emotionSubmitBtn,
          !pickedEmotion && styles.submitBtnDisabled,
          pressed && pickedEmotion && { opacity: 0.9 },
        ]}
      >
        <Text style={styles.submitBtnText}>사진 추가</Text>
      </Pressable>
      <Pressable onPress={resetEmotionModal} style={styles.modalCancel}>
        <Text style={styles.modalCancelText}>취소</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  galleryRoot: {
    flex: 1,
    minHeight: 0,
  },
  galleryRootWeb: {
    width: '100%',
    minHeight: '100%',
  },
  galleryFitColumn: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
  },
  galleryMiddle: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryBottom: {
    flexShrink: 0,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flexShrink: 0,
  },
  archiveBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  archiveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkMuted,
  },
  emoji: {
    fontSize: 18,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: notebook.ink,
  },
  titleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  pageDateHint: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkMuted,
  },
  fourCutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  clearAllSlotsBtn: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  clearAllSlotsText: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkLight,
  },
  moodiShareOffscreen: {
    position: 'absolute',
    left: -12000,
    top: 0,
  },
  moodiShareCaptureRoot: {
    alignItems: 'center',
  },
  saveMoodiBtn: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodiCaptureOuter: {
    width: '100%',
  },
  moodiCaptureOuterFlex: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  frameColorPickerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameColorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingHorizontal: 4,
    maxWidth: '100%',
  },
  frameChipOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  frameChipOuterSelected: {
    borderColor: notebook.ink,
    backgroundColor: 'rgba(61, 61, 61, 0.06)',
    transform: [{ scale: 1.15 }],
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  frameChipDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
  },
  fourCutCardFit: {
    flex: 1,
    minHeight: 0,
  },
  fourCutCard: {
    borderRadius: 16,
    backgroundColor: OUTER_CARD_BACKGROUND,
    padding: 11,
    marginBottom: 0,
    maxWidth: 380,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.065,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdropFixed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  modalCardHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
  },
  emotionModalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginBottom: 8,
  },
  emotionModalScroll: {
    width: '100%',
    maxWidth: '100%',
  },
  emotionSheet: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingTop: 18,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  emotionPickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  emotionPickerRowWrap: {
    marginTop: 6,
  },
  emotionRowModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 2,
  },
  emotionCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  emotionCircleBtnSelected: {
    borderWidth: 2.5,
    transform: [{ scale: 1.06 }],
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emotionSubmitBtn: {
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: notebook.ink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancel: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalCancelText: {
    fontSize: 15,
    color: notebook.inkLight,
    fontWeight: '600',
  },
  memoModalCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  memoModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
    marginBottom: 14,
  },
  memoModalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: notebook.ink,
    minHeight: 100,
    maxHeight: 160,
    ...Platform.select({
      android: { textAlignVertical: 'top' },
    }),
  },
  memoModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  memoModalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  memoModalSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: notebook.ink,
  },
  slotModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  slotModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  slotSheet: {
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    maxHeight: '78%',
  },
  clearSlotBtn: {
    alignSelf: 'center',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  clearSlotBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c45c5c',
  },
  addAlbumLink: {
    alignSelf: 'center',
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addAlbumLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: notebook.inkMuted,
  },
  emptyPicker: {
    textAlign: 'center',
    color: notebook.inkMuted,
    paddingVertical: 20,
    lineHeight: 20,
    fontSize: 13,
  },
  pickerScroll: {
    maxHeight: 320,
  },
  pickerGrid: {
    paddingBottom: 8,
  },
  pickerRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  pickerThumbWrap: {
    width: '30%',
    minWidth: 96,
    maxWidth: 120,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    padding: 2,
    backgroundColor: '#fff',
  },
  pickerThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: notebook.ink,
  },
});

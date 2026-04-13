import { Image, StyleSheet, Text, View } from 'react-native';
import { moodPalette } from '../constants/theme';
import { getMoodiFrameVisuals } from '../utils/moodiFrameVisuals';

/** Portrait slot: width : height = 3 : 4 (matches Gallery) */
const SLOT_ASPECT = 3 / 4;

/** Outer shell — same neutral as Gallery card */
const OUTER_CARD_BACKGROUND = '#E5E5E5';

/**
 * Read-only 2×2 Moodi preview: same structure as the main canvas grid, no interaction.
 *
 * @param {{ id?: string, imageUri?: string, emotionId?: string } | null}[]} slots — length 4
 * @param {string} [innerFrameColorKey='white']
 * @param {number} width — total width of the outer card (including gray border)
 * @param {'compact' | 'detail'} [variant='compact'] — compact: title hidden; detail: shows canvas title
 * @param {string} [canvasDateText] — optional date line inside canvas footer (detail)
 */
export default function MoodiFourCutReadOnly({
  slots,
  innerFrameColorKey = 'white',
  width,
  variant = 'compact',
  canvasDateText,
}) {
  const fv = getMoodiFrameVisuals(innerFrameColorKey || 'white');
  const list = Array.isArray(slots) && slots.length === 4 ? slots : [null, null, null, null];
  const isDetail = variant === 'detail';

  const outerPad = isDetail ? 6 : 4;
  const innerPad = isDetail ? 8 : 6;
  const gridGap = isDetail ? 6 : 4;
  const innerCanvasW = width - outerPad * 2;
  const gridW = innerCanvasW - innerPad * 2;
  const slotW = (gridW - gridGap) / 2;
  const slotH = slotW / SLOT_ASPECT;

  const titleFontSize = isDetail ? 14 : 11;
  const titleMb = isDetail ? 8 : 5;
  const footerMt = isDetail ? 8 : 4;
  const dateFontSize = isDetail ? 10 : 8;
  const brandFontSize = isDetail ? 8 : 7;

  return (
    <View style={[styles.outer, { width, backgroundColor: OUTER_CARD_BACKGROUND, padding: outerPad }]}>
      <View
        style={[
          styles.canvas,
          {
            backgroundColor: fv.frameBg,
            borderColor: fv.frameBorder,
            paddingHorizontal: innerPad,
            paddingTop: innerPad,
            paddingBottom: innerPad,
          },
        ]}
      >
        {isDetail ? (
          <Text
            style={[
              styles.canvasTitle,
              {
                color: fv.titleColor,
                opacity: fv.titleOpacity,
                fontSize: titleFontSize,
                marginBottom: titleMb,
              },
            ]}
            numberOfLines={1}
          >
            {"Today's Moodi"}
          </Text>
        ) : null}

        <View style={[styles.gridWrap, { width: gridW, gap: gridGap }]}>
          <View style={[styles.gridRow, { gap: gridGap }]}>
            <ReadOnlySlot item={list[0]} slotW={slotW} slotH={slotH} fv={fv} />
            <ReadOnlySlot item={list[1]} slotW={slotW} slotH={slotH} fv={fv} />
          </View>
          <View style={[styles.gridRow, { gap: gridGap }]}>
            <ReadOnlySlot item={list[2]} slotW={slotW} slotH={slotH} fv={fv} />
            <ReadOnlySlot item={list[3]} slotW={slotW} slotH={slotH} fv={fv} />
          </View>
        </View>

        {isDetail && canvasDateText ? (
          <View style={[styles.footerMeta, { marginTop: footerMt }]}>
            <Text style={[styles.canvasDate, { color: fv.dateColor, fontSize: dateFontSize }]}>
              {canvasDateText}
            </Text>
            <Text
              style={[
                styles.canvasBrand,
                { color: fv.brandColor, opacity: fv.brandOpacity, fontSize: brandFontSize },
              ]}
            >
              Moodi
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ReadOnlySlot({ item, slotW, slotH, fv }) {
  const eid = item?.emotionId || 'happy';
  const pal = moodPalette[eid] ?? moodPalette.happy;

  if (item?.imageUri) {
    return (
      <View
        style={[
          styles.slotFrame,
          {
            width: slotW,
            height: slotH,
            borderColor: pal.border,
            backgroundColor: fv.photoWellBg,
          },
        ]}
      >
        <Image source={{ uri: item.imageUri }} style={styles.slotImg} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.slotEmpty,
        {
          width: slotW,
          height: slotH,
          borderColor: fv.slotEmptyBorder,
          backgroundColor: fv.slotEmptyBg,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 12,
    alignSelf: 'center',
  },
  canvas: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  canvasTitle: {
    width: '100%',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.35,
  },
  gridWrap: {
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
  },
  slotFrame: {
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  slotImg: {
    width: '100%',
    height: '100%',
  },
  slotEmpty: {
    borderRadius: 6,
    borderWidth: 1,
  },
  footerMeta: {
    alignItems: 'center',
    gap: 1,
  },
  canvasDate: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  canvasBrand: {
    fontWeight: '600',
    letterSpacing: 0.9,
  },
});

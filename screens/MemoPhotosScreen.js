import { Ellipsis, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { pickMemoPhoto } from '../utils/pickMemoPhoto';
import { useRef, useState } from 'react';
import { Animated, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import NotebookLayout from '../components/NotebookLayout';
import { notebook } from '../constants/theme';
import { useMood } from '../src/context/MoodContext';
import { formatDateKeyForDisplay, getEntryTimelineDateKey } from '../storage/timelineStateStorage';
import { paletteFor, splitMemo } from '../utils/timelineEntryFormat';

function PhotoFrame({ emotionId, style, children }) {
  const palette = paletteFor(emotionId);
  return (
    <LinearGradient
      colors={[palette.border, palette.bg, '#fff']}
      locations={[0, 0.5, 0.95]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.frame, style]}
    >
      {children}
    </LinearGradient>
  );
}

function MemoPhoto({ entry, style, resizeMode }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <View style={[style, styles.unavailable]}>
      <Text style={styles.muted}>사진을 열 수 없어요</Text>
    </View>
  ) : (
    <Image source={{ uri: entry.imageUri }} style={style} resizeMode={resizeMode} onError={() => setFailed(true)} />
  );
}

export default function MemoPhotosScreen() {
  const { entries, updateEntry } = useMood();
  const [activeId, setActiveId] = useState(null);
  const [previewLayout, setPreviewLayout] = useState(null);
  const zoom = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const photoRefs = useRef(new Map());
  const opening = useRef(false);
  const photos = entries
    .filter((entry) => entry.keepPhotoCard || Boolean(entry.imageUri?.trim()))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const preview = photos.find((entry) => entry.id === previewLayout?.id);
  const previewWidth = Math.min(width - 32, 760);
  const imageHeight = Math.min((previewWidth - 20) / (previewLayout?.ratio || 1), Math.max(72, height - 112));
  const originX = previewLayout?.origin ? previewLayout.origin.x - width / 2 : 0;
  const originY = previewLayout?.origin ? previewLayout.origin.y - height / 2 : 0;
  const initialScale = previewLayout?.origin ? Math.min(1, previewLayout.origin.width / previewWidth) : 0.86;

  const openPreview = async (item) => {
    if (opening.current) return;
    opening.current = true;
    try {
      const node = photoRefs.current.get(item.id);
      const [origin, dimensions] = await Promise.all([
        new Promise((resolve) => {
          if (!node) {
            resolve(null);
            return;
          }
          node.measureInWindow((x, y, measuredWidth, measuredHeight) => {
            resolve(measuredWidth > 0 ? {
              x: x + measuredWidth / 2,
              y: y + measuredHeight / 2,
              width: measuredWidth,
            } : null);
          });
        }),
        new Promise((resolve) => {
          Image.getSize(
            item.imageUri,
            (imageWidth, imageHeight) => resolve({ width: imageWidth, height: imageHeight }),
            () => resolve(null),
          );
        }),
      ]);
      zoom.setValue(0);
      setPreviewLayout({
        id: item.id,
        origin,
        ratio: dimensions?.width && dimensions?.height ? dimensions.width / dimensions.height : 1,
      });
    } finally {
      opening.current = false;
    }
  };
  const closePreview = () => {
    zoom.stopAnimation();
    setPreviewLayout(null);
  };
  const animatePreview = () => {
    Animated.timing(zoom, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  const [replacing, setReplacing] = useState(false);
  const [failedId, setFailedId] = useState(null);

  const replacePhoto = async (id) => {
    if (replacing) return;
    setReplacing(true);
    setFailedId(null);
    try {
      const imageUri = await pickMemoPhoto();
      if (imageUri) {
        updateEntry(id, { imageUri });
        setActiveId(null);
      }
    } catch {
      setFailedId(id);
    } finally {
      setReplacing(false);
    }
  };

  const removePhoto = (id) => {
    updateEntry(id, { imageUri: null, keepPhotoCard: true });
    setActiveId(null);
    setFailedId(null);
  };
  return (
    <NotebookLayout>
      <FlatList
        data={photos}
        numColumns={2}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.columns}
        ListHeaderComponent={<Text style={styles.heading}>사진 모아보기</Text>}
        ListEmptyComponent={<Text style={styles.muted}>메모에 사진을 붙이면 여기에 모여요.</Text>}
        renderItem={({ item }) => {
          const active = activeId === item.id;
          const title = splitMemo(item.memo).title || formatDateKeyForDisplay(getEntryTimelineDateKey(item));
          return (
            <View style={styles.tile}>
              <PhotoFrame emotionId={item.emotionId}>
                <View
                  style={styles.photoArea}
                  collapsable={false}
                  ref={(node) => {
                    if (node) photoRefs.current.set(item.id, node);
                    else photoRefs.current.delete(item.id);
                  }}
                >
                  {item.imageUri ? (
                    <MemoPhoto key={item.imageUri} entry={item} style={styles.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbnail, styles.unavailable]}>
                      <Text style={styles.muted}>첨부된 사진 없음</Text>
                    </View>
                  )}
                  <Pressable
                    style={[StyleSheet.absoluteFill, active && styles.photoShade]}
                    onPress={() => {
                      setFailedId(null);
                      if (active || !item.imageUri) {
                        setActiveId(active ? null : item.id);
                        return;
                      }
                      setActiveId(null);
                      openPreview(item);
                    }}
                    disabled={replacing}
                    accessibilityRole="button"
                    accessibilityLabel={active ? '사진 메뉴 닫기' : `${title} ${item.imageUri ? "사진 크게 보기" : "사진 관리"}`}
                    accessibilityState={{ expanded: active }}
                  />
                  {active ? (
                    <View style={styles.actions} pointerEvents="box-none">
                      <Pressable style={styles.action} disabled={replacing} onPress={() => replacePhoto(item.id)} accessibilityRole="button" accessibilityLabel="사진 수정">
                        <Text style={styles.actionText}>수정</Text>
                      </Pressable>
                      {item.imageUri ? (
                        <Pressable style={styles.action} disabled={replacing} onPress={() => removePhoto(item.id)} accessibilityRole="button" accessibilityLabel="첨부 사진 삭제">
                          <Text style={[styles.actionText, styles.deleteText]}>삭제</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <View style={styles.captionRow}>
                  <Text style={styles.caption} numberOfLines={1}>{title}</Text>
                  <Pressable
                    style={styles.menu}
                    onPress={() => {
                      setActiveId(active ? null : item.id);
                      setFailedId(null);
                    }}
                    disabled={replacing}
                    accessibilityRole="button"
                    accessibilityLabel="사진 수정 및 삭제"
                    accessibilityState={{ expanded: active }}
                  >
                    <Ellipsis size={19} color={notebook.inkMuted} />
                  </Pressable>
                </View>
                {active && failedId === item.id ? <Text style={styles.muted}>다시 첨부해 주세요.</Text> : null}
              </PhotoFrame>
            </View>
          );
        }}
      />
      <Modal visible={Boolean(preview?.imageUri)} transparent onShow={animatePreview} onRequestClose={closePreview}>
        {preview?.imageUri ? (
          <View style={styles.previewOverlay}>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.previewVeil,
                { opacity: zoom.interpolate({ inputRange: [0, 1], outputRange: [0, 0.38] }) },
              ]}
            />
            <Pressable style={StyleSheet.absoluteFill} onPress={closePreview} accessibilityRole="button" accessibilityLabel="사진 닫기" />
            <Animated.View
              style={[
                styles.previewCard,
                {
                  opacity: zoom.interpolate({ inputRange: [0, 1], outputRange: [0.22, 1] }),
                  transform: [
                    { translateX: zoom.interpolate({ inputRange: [0, 1], outputRange: [originX, 0] }) },
                    { translateY: zoom.interpolate({ inputRange: [0, 1], outputRange: [originY, 0] }) },
                    { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [initialScale, 1] }) },
                  ],
                },
              ]}
            >
              <PhotoFrame emotionId={preview.emotionId} style={styles.previewFrame}>
                <View style={styles.previewSurface}>
                  <Pressable style={styles.previewClose} onPress={closePreview} accessibilityRole="button" accessibilityLabel="닫기">
                    <X size={22} color={notebook.inkMuted} />
                  </Pressable>
                  <MemoPhoto key={preview.imageUri} entry={preview} style={[styles.previewImage, { height: imageHeight }]} resizeMode="contain" />
                </View>
              </PhotoFrame>
            </Animated.View>
          </View>
        ) : null}
      </Modal>
    </NotebookLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  columns: { gap: 12, marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: '800', color: notebook.ink, marginBottom: 12 },
  tile: { width: '48%', flexShrink: 1, borderRadius: 12, overflow: 'hidden' },
  frame: { padding: 6 },
  photoArea: { borderRadius: 8, overflow: 'hidden' },
  photoShade: { backgroundColor: 'rgba(215, 220, 226, 0.72)' },
  actions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#fff' },
  actionText: { color: notebook.ink, fontWeight: '700' },
  deleteText: { color: '#b91c1c' },
  thumbnail: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: notebook.bg },
  captionRow: { flexDirection: 'row', alignItems: 'center' },
  menu: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  previewOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  previewVeil: { backgroundColor: '#fff' },
  previewCard: {
    width: '100%',
    maxWidth: 760,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  },
  previewFrame: { borderRadius: 16 },
  previewSurface: { backgroundColor: '#fff', borderRadius: 10, padding: 4 },
  previewClose: { alignSelf: 'flex-end', width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%' },
  caption: { flex: 1, minWidth: 0, color: notebook.ink, paddingVertical: 6, fontSize: 13 },
  muted: { color: notebook.inkMuted, textAlign: 'center' },
  unavailable: { justifyContent: 'center', alignItems: 'center', padding: 4 },
});

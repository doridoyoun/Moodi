import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FAB, Portal } from 'react-native-paper';
import NotebookLayout from '../components/NotebookLayout';
import { moodOrder, moodPalette, notebook } from '../constants/theme';
import {
  loadGalleryState,
  saveGalleryState,
} from '../storage/galleryStateStorage';

const FOUR_EMPTY = () => /** @type {(string|null)[]} */ ([null, null, null, null]);

function newId() {
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 감정 색 테두리용: border 색을 메인으로 사용 */
function emotionColorHex(emotionId) {
  return moodPalette[emotionId]?.border ?? moodPalette.happy.border;
}

function formatTimeShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const [albumItems, setAlbumItems] = useState([]);
  const [fourSlotIds, setFourSlotIds] = useState(FOUR_EMPTY);

  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState(null);

  const [slotPickerVisible, setSlotPickerVisible] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  const hydrated = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadGalleryState();
      if (cancelled) return;
      setAlbumItems(data.albumItems);
      setFourSlotIds(data.fourSlotIds);
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveGalleryState({ albumItems, fourSlotIds }).catch(() => {});
    }, 350);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [albumItems, fourSlotIds]);

  const openImagePickerForNewAlbum = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    });

    if (result.canceled || !result.assets?.[0]) return;
    setPendingImageUri(result.assets[0].uri);
    setEmotionModalVisible(true);
  }, []);

  const confirmEmotionAndAddToAlbum = useCallback((emotionId) => {
    if (!pendingImageUri) return;
    const item = {
      id: newId(),
      imageUri: pendingImageUri,
      emotionColor: emotionColorHex(emotionId),
      timestamp: new Date().toISOString(),
    };
    setAlbumItems((prev) => [item, ...prev]);
    setPendingImageUri(null);
    setEmotionModalVisible(false);
  }, [pendingImageUri]);

  const cancelEmotionModal = useCallback(() => {
    setPendingImageUri(null);
    setEmotionModalVisible(false);
  }, []);

  const openSlotPicker = useCallback((slotIndex) => {
    setActiveSlotIndex(slotIndex);
    setSlotPickerVisible(true);
  }, []);

  const selectAlbumForSlot = useCallback(
    (albumId) => {
      setFourSlotIds((prev) => {
        const next = [...prev];
        next[activeSlotIndex] = albumId;
        return next;
      });
      setSlotPickerVisible(false);
    },
    [activeSlotIndex],
  );

  const clearActiveSlot = useCallback(() => {
    setFourSlotIds((prev) => {
      const next = [...prev];
      next[activeSlotIndex] = null;
      return next;
    });
    setSlotPickerVisible(false);
  }, [activeSlotIndex]);

  const resolveItem = useCallback(
    (id) => albumItems.find((a) => a.id === id),
    [albumItems],
  );

  return (
    <NotebookLayout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pagePad}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.emoji}>📷</Text>
          <Text style={styles.pageTitle}>Mood Gallery</Text>
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionKicker}>Four-Cut</Text>
          <Text style={styles.sectionTitle}>오늘의 네컷</Text>
          <Text style={styles.sectionHint}>
            슬롯을 눌러 앨범 사진을 넣거나 바꿀 수 있어요
          </Text>
        </View>

        <View style={styles.fourCutCard}>
          <Text style={styles.shotTitle}>오늘의 네컷</Text>
          <View style={styles.grid2x2}>
            <View style={styles.gridRow}>
              {[0, 1].map((i) => (
                <FourCutEmptySlot
                  key={i}
                  item={fourSlotIds[i] ? resolveItem(fourSlotIds[i]) : null}
                  onPress={() => openSlotPicker(i)}
                />
              ))}
            </View>
            <View style={styles.gridRow}>
              {[2, 3].map((i) => (
                <FourCutEmptySlot
                  key={i}
                  item={fourSlotIds[i] ? resolveItem(fourSlotIds[i]) : null}
                  onPress={() => openSlotPicker(i)}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.archiveHeader}>
          <Text style={styles.sectionKicker}>Archive</Text>
          <Text style={styles.sectionTitle}>감정 폴라로이드 앨범</Text>
        </View>

        {albumItems.length === 0 ? (
          <Text style={styles.emptyArchive}>
            사진 추가 버튼으로 감정과 함께 기록을 남겨 보세요.
          </Text>
        ) : (
          <View style={styles.archiveGrid}>
            {albumItems.map((item) => (
              <AlbumPolaroid key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>

      <Portal>
        <FAB
          icon="plus"
          style={[
            styles.fab,
            { bottom: insets.bottom + 56, right: Math.max(16, insets.right + 8) },
          ]}
          onPress={openImagePickerForNewAlbum}
          accessibilityLabel="감정 폴라로이드 사진 추가"
        />
      </Portal>

      <Modal
        visible={emotionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelEmotionModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={cancelEmotionModal}>
          <Pressable style={styles.emotionSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>감정을 선택해 주세요</Text>
            <View style={styles.emotionGrid}>
              {moodOrder.map((id) => {
                const m = moodPalette[id];
                return (
                  <Pressable
                    key={id}
                    onPress={() => confirmEmotionAndAddToAlbum(id)}
                    style={({ pressed }) => [
                      styles.emotionChip,
                      { backgroundColor: m.bg, borderColor: m.border },
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <Text style={[styles.emotionChipLabel, { color: m.ink }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={cancelEmotionModal} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>취소</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
            <Text style={styles.modalTitle}>앨범에서 선택</Text>
            <Text style={styles.slotModalSub}>
              네컷 {activeSlotIndex + 1}번 슬롯
            </Text>
            {fourSlotIds[activeSlotIndex] ? (
              <Pressable style={styles.clearSlotBtn} onPress={clearActiveSlot}>
                <Text style={styles.clearSlotBtnText}>이 슬롯 비우기</Text>
              </Pressable>
            ) : null}
            {albumItems.length === 0 ? (
              <Text style={styles.emptyPicker}>앨범에 사진을 먼저 추가해 주세요.</Text>
            ) : (
              <FlatList
                data={albumItems}
                keyExtractor={(it) => it.id}
                numColumns={3}
                contentContainerStyle={styles.pickerGrid}
                columnWrapperStyle={styles.pickerRow}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.pickerThumbWrap,
                      { borderColor: item.emotionColor },
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => selectAlbumForSlot(item.id)}
                  >
                    <Image source={{ uri: item.imageUri }} style={styles.pickerThumb} />
                  </Pressable>
                )}
              />
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

function FourCutEmptySlot({ item, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.emptySlotOuter,
        pressed && { opacity: 0.92 },
      ]}
    >
      {item ? (
        <View style={[styles.slotPolaroidInner, { borderColor: item.emotionColor }]}>
          <Image source={{ uri: item.imageUri }} style={styles.slotImage} resizeMode="cover" />
        </View>
      ) : (
        <View style={styles.emptySlotInner}>
          <Text style={styles.plus}>＋</Text>
        </View>
      )}
    </Pressable>
  );
}

function AlbumPolaroid({ item }) {
  const time = formatTimeShort(item.timestamp);
  return (
    <View style={styles.polaroid}>
      <View
        style={[
          styles.polaroidFrame,
          {
            borderColor: item.emotionColor,
            shadowColor: item.emotionColor,
          },
        ]}
      >
        <View style={styles.polaroidPhotoInner}>
          <Image source={{ uri: item.imageUri }} style={styles.polaroidImage} resizeMode="cover" />
        </View>
      </View>
      <View style={styles.polaroidMeta}>
        <Text style={styles.polaroidTime} numberOfLines={1}>
          {time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  pagePad: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  emoji: {
    fontSize: 18,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: notebook.ink,
  },
  sectionLabel: {
    marginBottom: 10,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: notebook.inkLight,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    marginTop: 2,
  },
  sectionHint: {
    marginTop: 6,
    fontSize: 13,
    color: notebook.inkMuted,
  },
  fourCutCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  shotTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
    marginBottom: 14,
  },
  grid2x2: {
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptySlotOuter: {
    flex: 1,
  },
  emptySlotInner: {
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  slotPolaroidInner: {
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 3,
    padding: 3,
    backgroundColor: '#fff',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  slotImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  plus: {
    fontSize: 28,
    color: notebook.inkLight,
    fontWeight: '300',
  },
  archiveHeader: {
    marginBottom: 12,
  },
  emptyArchive: {
    fontSize: 14,
    color: notebook.inkMuted,
    textAlign: 'center',
    paddingVertical: 24,
    lineHeight: 20,
  },
  archiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  polaroid: {
    width: '48%',
    marginBottom: 4,
  },
  polaroidFrame: {
    borderRadius: 14,
    borderWidth: 3,
    padding: 4,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  polaroidPhotoInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f2f5',
  },
  polaroidImage: {
    width: '100%',
    height: '100%',
  },
  polaroidMeta: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  polaroidTime: {
    fontSize: 11,
    fontWeight: '600',
    color: notebook.inkMuted,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 0,
    backgroundColor: notebook.ink,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  emotionSheet: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
    marginBottom: 16,
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  emotionChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 2,
    minWidth: '28%',
    alignItems: 'center',
  },
  emotionChipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalCancel: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 15,
    color: notebook.inkLight,
    fontWeight: '600',
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    maxHeight: '72%',
  },
  slotModalSub: {
    fontSize: 13,
    color: notebook.inkMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  clearSlotBtn: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  clearSlotBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c45c5c',
  },
  emptyPicker: {
    textAlign: 'center',
    color: notebook.inkMuted,
    paddingVertical: 24,
  },
  pickerGrid: {
    paddingBottom: 8,
  },
  pickerRow: {
    gap: 8,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  pickerThumbWrap: {
    flexGrow: 1,
    flexBasis: '31%',
    maxWidth: '32%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 3,
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

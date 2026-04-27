import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CloudRain, Flame, Heart, Leaf, Smile, X } from 'lucide-react-native';
import CenteredKeyboardFormModal from '../CenteredKeyboardFormModal';
import { moodOrder, moodPalette, notebook } from '../../constants/theme';
import { formatEntryDisplayTime, splitMemo } from '../../utils/timelineEntryFormat';
import EmotionDisplayToken from './EmotionDisplayToken';

const moodIcons = {
  happy: Smile,
  flutter: Heart,
  calm: Leaf,
  gloom: CloudRain,
  annoyed: Flame,
};

function normalizeImageUri(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  return s;
}

export default function EntryDetailModalCard({
  visible,
  entry,
  isDetailEditing,
  detailEditEmotion,
  setDetailEditEmotion,
  detailEditTitle,
  setDetailEditTitle,
  detailEditContent,
  setDetailEditContent,
  bottomInset,
  dateKey,
  onClose,
  onRequestClose,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onConfirmDelete,
  setRepresentativeOverrideForDate,
  detailEditImageUri,
  setDetailEditImageUri,
}) {
  const [viewPhotoFailed, setViewPhotoFailed] = useState(false);
  const [editPhotoFailed, setEditPhotoFailed] = useState(false);
  const [manageExpanded, setManageExpanded] = useState(false);

  const split = entry ? splitMemo(entry.memo) : { title: '', content: '' };
  const pal = entry ? moodPalette[entry.emotionId] ?? moodPalette.happy : moodPalette.happy;
  const emotionLabel = entry ? pal.label : '';
  const timeText = formatEntryDisplayTime(entry);

  const pickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    const uri = asset?.uri;
    if (typeof uri !== 'string' || uri.trim().length === 0) return;

    try {
      const w = typeof asset?.width === 'number' ? asset.width : null;
      const actions = w && w > 800 ? [{ resize: { width: 800 } }] : [];
      const manipulated = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const nextUri = typeof manipulated?.uri === 'string' && manipulated.uri.trim().length > 0 ? manipulated.uri : uri;
      setDetailEditImageUri?.(nextUri);
    } catch (e) {
      console.log('IMAGE MANIPULATE ERROR:', e);
      setDetailEditImageUri?.(uri);
    }
  }, [setDetailEditImageUri]);

  const clearPhoto = useCallback(() => {
    setDetailEditImageUri?.(null);
  }, [setDetailEditImageUri]);

  const viewPhotoUri = useMemo(() => normalizeImageUri(entry?.imageUri), [entry?.imageUri]);
  const editPhotoUri = useMemo(() => normalizeImageUri(detailEditImageUri), [detailEditImageUri]);
  const entryDateKey = useMemo(() => {
    const dk = typeof entry?.timelineDateKey === 'string' ? entry.timelineDateKey : '';
    if (dk) return dk;
    return typeof dateKey === 'string' ? dateKey : '';
  }, [dateKey, entry?.timelineDateKey]);

  useEffect(() => {
    setViewPhotoFailed(false);
  }, [viewPhotoUri, entry?.id]);

  useEffect(() => {
    setEditPhotoFailed(false);
  }, [editPhotoUri]);

  useEffect(() => {
    setManageExpanded(false);
  }, [visible, entry?.id, isDetailEditing]);

  return (
    <CenteredKeyboardFormModal
      visible={visible}
      onRequestClose={onRequestClose}
      onBackdropPress={isDetailEditing ? onCancelEdit : onClose}
      bottomInset={bottomInset}
      backdropColor="rgba(15, 23, 42, 0.35)"
      maxHeightRatio={0.8}
      scrollEnabled={false}
      keyboardAware={false}
    >
      <View style={styles.card} pointerEvents="auto">
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          hitSlop={12}
        >
          <X size={22} color={notebook.inkMuted} strokeWidth={2} />
        </Pressable>

        {entry && isDetailEditing ? (
          <View style={styles.editHeader}>
            <View style={styles.editEmotionRow}>
              {moodOrder.map((key) => {
                const Icon = moodIcons[key];
                const m = moodPalette[key];
                const selected = detailEditEmotion === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={m.label}
                    onPress={() => setDetailEditEmotion(key)}
                    style={({ pressed }) => [
                      styles.editFab,
                      { backgroundColor: m.bg, borderColor: m.border },
                      selected && styles.editFabSelected,
                      !selected && { opacity: 0.45 },
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <Icon size={17} color={m.ink} strokeWidth={2} />
                    <Text style={[styles.editFabLabel, { color: m.ink }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {entry && !isDetailEditing ? (
            <View style={styles.bodyBlock}>
              <View style={styles.viewMeta}>
                <EmotionDisplayToken emotionId={entry.emotionId} size="detail" showTime={false} compact />
                <View style={styles.viewMetaText}>
                  <Text style={[styles.emotionLabel, { color: pal.ink }]}>{emotionLabel}</Text>
                  <Text style={styles.timeText}>{timeText}</Text>
                </View>
              </View>
              {split.title ? <Text style={styles.title}>{split.title}</Text> : null}
              {split.content ? (
                <Text style={styles.bodyText}>{split.content}</Text>
              ) : !split.title ? (
                <Text style={styles.bodyMuted}>(내용 없음)</Text>
              ) : null}
              {viewPhotoUri && !viewPhotoFailed ? (
                <Image
                  source={{ uri: viewPhotoUri }}
                  style={styles.viewPhoto}
                  resizeMode="cover"
                  onError={() => {
                    console.log('IMAGE ERROR:', viewPhotoUri);
                    setViewPhotoFailed(true);
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {entry && isDetailEditing ? (
            <View style={styles.bodyEdit}>
              <TextInput
                style={styles.titleInput}
                placeholder="제목 (선택)"
                placeholderTextColor={notebook.inkLight}
                value={detailEditTitle}
                onChangeText={setDetailEditTitle}
                maxLength={200}
              />
              <TextInput
                style={styles.memoInput}
                placeholder="내용 (선택)"
                placeholderTextColor={notebook.inkLight}
                value={detailEditContent}
                onChangeText={setDetailEditContent}
                multiline
                maxLength={500}
              />
              <Text style={styles.photoHint}>사진은 메모에 최대 1장 붙일 수 있어요</Text>
              {editPhotoUri && !editPhotoFailed ? (
                <Image
                  source={{ uri: editPhotoUri }}
                  style={styles.editPhoto}
                  resizeMode="cover"
                  onError={() => {
                    console.log('IMAGE ERROR:', editPhotoUri);
                    setEditPhotoFailed(true);
                  }}
                />
              ) : null}
              <View style={styles.photoActions}>
                <Pressable
                  style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.85 }]}
                  onPress={pickPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="사진 선택"
                >
                  <Text style={styles.photoBtnText}>{editPhotoUri ? '사진 바꾸기' : '사진 추가'}</Text>
                </Pressable>
                {editPhotoUri ? (
                  <Pressable
                    style={({ pressed }) => [styles.photoBtnSecondary, pressed && { opacity: 0.85 }]}
                    onPress={clearPhoto}
                    accessibilityRole="button"
                    accessibilityLabel="사진 삭제"
                  >
                    <Text style={styles.photoBtnSecondaryText}>사진 삭제</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {entry ? (
          <View style={[styles.footer, { paddingBottom: Math.max(bottomInset ?? 0, 16) }]}>
            {!isDetailEditing ? (
              <View style={styles.manageWrap}>
                <Pressable
                  style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.88 }]}
                  onPress={() => setManageExpanded((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel="이 기록 관리하기"
                >
                  <Text style={styles.manageBtnText}>이 기록 관리하기</Text>
                </Pressable>

                {manageExpanded ? (
                  <View style={styles.manageActions}>
                    <Pressable
                      style={({ pressed }) => [styles.manageActionItem, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        setManageExpanded(false);
                        onBeginEdit?.();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="수정"
                    >
                      <Text style={styles.manageActionText}>수정</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [styles.manageActionItem, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        setManageExpanded(false);
                        if (entry?.id) onConfirmDelete?.(entry.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="삭제"
                    >
                      <Text style={[styles.manageActionText, styles.manageDangerText]}>삭제</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [styles.manageActionItem, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        if (!entry?.id) return;
                        if (!entryDateKey) return;
                        setRepresentativeOverrideForDate?.(entryDateKey, entry.id);
                        setManageExpanded(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="오늘의 한 줄로 선택"
                    >
                      <Text style={styles.manageActionText}>오늘의 한 줄로 선택</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.88 }]}
                  onPress={() => {
                    Keyboard.dismiss();
                    onCancelEdit();
                  }}
                >
                  <Text style={styles.btnSecondaryText}>취소</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}
                  onPress={() => {
                    Keyboard.dismiss();
                    onSaveEdit();
                  }}
                >
                  <Text style={styles.btnPrimaryText}>저장</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>
    </CenteredKeyboardFormModal>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 22,
    backgroundColor: '#fff',
    overflow: 'hidden',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  editHeader: {
    paddingTop: 44,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  contentScroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyBlock: {
    paddingTop: 44,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  bodyEdit: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  viewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  viewMetaText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  emotionLabel: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  timeText: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
    color: notebook.inkLight,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: notebook.ink,
    lineHeight: 28,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: notebook.ink,
  },
  bodyMuted: {
    fontSize: 14,
    color: notebook.inkLight,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
    backgroundColor: '#fff',
  },
  manageWrap: {
    flex: 1,
  },
  manageBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: notebook.gridLine,
    backgroundColor: notebook.bg,
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: notebook.inkMuted,
  },
  manageActions: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
    backgroundColor: '#fff',
  },
  manageActionItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
  },
  manageActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
  },
  manageDangerText: {
    color: '#b91c1c',
  },
  btnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: notebook.gridLine,
    backgroundColor: '#fff',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: notebook.ink,
  },
  btnDanger: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(180, 40, 40, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(180, 40, 40, 0.35)',
  },
  btnDangerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b91c1c',
  },
  btnPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: notebook.ink,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  editEmotionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 14,
  },
  editFab: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 1,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  editFabSelected: {
    borderWidth: 3,
    opacity: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  editFabLabel: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '600',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: notebook.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: notebook.ink,
    backgroundColor: notebook.bg,
    marginBottom: 10,
  },
  memoInput: {
    minHeight: 110,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: notebook.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: notebook.ink,
    backgroundColor: notebook.bg,
    textAlignVertical: 'top',
  },
  viewPhoto: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    marginTop: 14,
    backgroundColor: notebook.bg,
  },
  photoHint: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '500',
    color: notebook.inkLight,
  },
  editPhoto: {
    width: 130,
    aspectRatio: 3 / 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: notebook.bg,
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  photoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: notebook.ink,
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  photoBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: notebook.gridLine,
    backgroundColor: '#fff',
  },
  photoBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: notebook.inkMuted,
  },
});

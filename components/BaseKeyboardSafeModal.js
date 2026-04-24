import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

const { height: WINDOW_H } = Dimensions.get('window');

/**
 * Structural shell only: Modal, dim backdrop, optional keyboard avoidance,
 * safe bottom inset, optional ScrollView, host alignment.
 * Card radius, padding, typography, and buttons stay in feature components.
 */
export default function BaseKeyboardSafeModal({
  visible,
  onRequestClose,
  onBackdropPress,
  children,
  bottomInset = 0,
  variant = 'centered',
  scrollEnabled = true,
  keyboardAware = true,
  maxHeightRatio,
  keyboardVerticalOffset = 0,
  animationType = 'fade',
  backdropColor = 'rgba(15, 23, 42, 0.35)',
  contentContainerStyle,
  hostStyle,
  cardStyle,
  useInnerPadding = false,
  centerScrollContent = true,
  scrollStyle,
  bounces = false,
}) {
  const bottomPad = Math.max(bottomInset, 12);
  const dismiss = onBackdropPress ?? onRequestClose;

  const maxBodyH =
    typeof maxHeightRatio === 'number' && maxHeightRatio > 0 && maxHeightRatio <= 1
      ? WINDOW_H * maxHeightRatio
      : undefined;

  const hostBase = variant === 'bottom-sheet' ? styles.hostBottomSheet : styles.hostCentered;

  const outerHostStyle = [hostBase, hostStyle, useInnerPadding && styles.hostPadH];

  const wrappedChildren = cardStyle ? <View style={cardStyle}>{children}</View> : children;

  const scrollContentStyle = [
    styles.scrollContent,
    variant === 'centered' && centerScrollContent && scrollEnabled && styles.scrollContentCentered,
    { paddingBottom: bottomPad },
    contentContainerStyle,
  ];

  const directBody = (
    <View
      style={[
        styles.directHost,
        variant === 'centered' && styles.directHostCentered,
        variant === 'bottom-sheet' && styles.directHostBottom,
        maxBodyH != null ? { maxHeight: maxBodyH } : { maxHeight: WINDOW_H * 0.8 },
        { paddingBottom: bottomPad },
      ]}
    >
      {wrappedChildren}
    </View>
  );

  const scrollBody = (
    <ScrollView
      style={[
        styles.scroll,
        maxBodyH != null ? { maxHeight: maxBodyH } : { maxHeight: WINDOW_H * 0.8 },
        scrollStyle,
      ]}
      contentContainerStyle={scrollContentStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={bounces}
    >
      {wrappedChildren}
    </ScrollView>
  );

  const inner = <View style={outerHostStyle}>{scrollEnabled ? scrollBody : directBody}</View>;

  const shell = keyboardAware ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.kav}
      keyboardVerticalOffset={keyboardVerticalOffset}
      pointerEvents="box-none"
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    <View style={styles.kav} pointerEvents="box-none">
      {inner}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onRequestClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: backdropColor }]}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        />
        {shell}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  hostCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingVertical: 24,
  },
  hostBottomSheet: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  hostPadH: {
    paddingHorizontal: 20,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    paddingVertical: 8,
  },
  scrollContentCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  directHost: {
    width: '100%',
    flexShrink: 1,
  },
  directHostCentered: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directHostBottom: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
});

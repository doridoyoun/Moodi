import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NotebookBackground from './NotebookBackground';
import NotebookHeader from './NotebookHeader';
import { notebook } from '../constants/theme';

export default function NotebookLayout({ children, footer }) {
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + 16;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <NotebookBackground />
        <NotebookHeader />
        <View style={[styles.body, !footer && { paddingBottom: bottomPad }]}>{children}</View>
        {footer ? <View style={[styles.footer, { paddingBottom: bottomPad }]}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: notebook.bg,
  },
  root: {
    flex: 1,
    backgroundColor: notebook.bg,
  },
  body: {
    flex: 1,
    paddingTop: 10,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
});

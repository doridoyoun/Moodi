import { StyleSheet, Text, View } from 'react-native';
import { notebook } from '../constants/theme';

export default function NotebookHeader() {
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <Text style={styles.flower} accessibilityLabel="Moodi logo">
          ✿
        </Text>
        <Text style={styles.logo}>Moodi</Text>
      </View>
      <Text style={styles.tagline}>my mood diary</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flower: {
    fontSize: 20,
    color: notebook.ink,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: notebook.ink,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 12,
    color: notebook.inkLight,
    letterSpacing: 0.3,
  },
});

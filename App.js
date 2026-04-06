import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainTabs from './navigation/MainTabs';
import { MemoFontProvider } from './src/context/MemoFontContext';
import { MoodProvider } from './src/context/MoodContext';
import { notebook } from './constants/theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: notebook.bg,
    card: notebook.bg,
    text: notebook.ink,
    border: notebook.gridLine,
    primary: notebook.ink,
  },
};

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: notebook.ink,
    background: notebook.bg,
    surface: 'rgba(255,255,255,0.95)',
    outline: notebook.gridLine,
    onSurface: notebook.ink,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <MoodProvider>
          <MemoFontProvider>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="dark" />
              <MainTabs />
            </NavigationContainer>
          </MemoFontProvider>
        </MoodProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CalendarScreen from '../screens/CalendarScreen';
import DailyAnalysisScreen from '../screens/DailyAnalysisScreen';
import MonthlyFlowView from '../screens/MonthlyFlowView';
import { notebook } from '../constants/theme';

const Stack = createNativeStackNavigator();

export default function CalendarStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: notebook.bg },
      }}
    >
      <Stack.Screen name="CalendarHome" component={CalendarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MonthlyFlow" component={MonthlyFlowView} options={{ headerShown: false }} />
      <Stack.Screen
        name="DailyAnalysis"
        component={DailyAnalysisScreen}
        options={{
          title: '이날의 기록',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: notebook.bg },
          headerTintColor: notebook.ink,
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
    </Stack.Navigator>
  );
}

import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Clock, Images } from 'lucide-react-native';
import CalendarStack from './CalendarStack';
import MemoPhotosScreen from '../screens/MemoPhotosScreen';
import TimelineScreen from '../screens/TimelineScreen';
import { notebook } from '../constants/theme';

const Tab = createBottomTabNavigator();

/** Extra top padding inside the tab bar. */
const TAB_BAR_MIN_TOP = 10;

const TAB_ICON_SIZE = 30;

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12);
  const minHeight = TAB_BAR_MIN_TOP + TAB_ICON_SIZE + bottomPad + 14;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: notebook.ink,
        tabBarInactiveTintColor: notebook.inkLight,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: notebook.gridLine,
          paddingTop: TAB_BAR_MIN_TOP,
          paddingBottom: bottomPad,
          paddingHorizontal: 8,
          minHeight,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 4,
        },
      }}
    >
      <Tab.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Clock color={color} size={TAB_ICON_SIZE} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="MemoPhotos"
        component={MemoPhotosScreen}
        options={{
          tabBarAccessibilityLabel: '사진 모아보기',
          tabBarIcon: ({ color }) => (
            <Images color={color} size={TAB_ICON_SIZE} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Calendar color={color} size={TAB_ICON_SIZE} strokeWidth={2} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Clock, Image as ImageIcon } from 'lucide-react-native';
import CalendarStack from './CalendarStack';
import GalleryStack from './GalleryStack';
import TimelineScreen from '../screens/TimelineScreen';
import { notebook } from '../constants/theme';

const Tab = createBottomTabNavigator();

/** Extra top padding inside the tab bar (taller, easier targets). */
const TAB_BAR_MIN_TOP = 20;

const TAB_ICON_SIZE = 30;

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + 16;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: notebook.ink,
        tabBarInactiveTintColor: notebook.inkLight,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: notebook.gridLine,
          paddingTop: TAB_BAR_MIN_TOP,
          paddingBottom: bottomPad,
          paddingHorizontal: 8,
          minHeight: 88,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginTop: 3,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 6,
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
        name="Gallery"
        component={GalleryStack}
        options={{
          tabBarIcon: ({ color }) => (
            <ImageIcon color={color} size={TAB_ICON_SIZE} strokeWidth={2} />
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

import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Clock, Image as ImageIcon } from 'lucide-react-native';
import CalendarScreen from '../screens/CalendarScreen';
import GalleryScreen from '../screens/GalleryScreen';
import TimelineScreen from '../screens/TimelineScreen';
import { notebook } from '../constants/theme';

const Tab = createBottomTabNavigator();

const TAB_BAR_MIN_TOP = 8;
const TAB_BAR_EXTRA_BOTTOM = 10;

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12) + TAB_BAR_EXTRA_BOTTOM;

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
          paddingHorizontal: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tab.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{
          tabBarIcon: ({ color, size }) => <ImageIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

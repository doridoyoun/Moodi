import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GalleryArchiveScreen from '../screens/GalleryArchiveScreen';
import GalleryScreen from '../screens/GalleryScreen';
import { notebook } from '../constants/theme';

const Stack = createNativeStackNavigator();

export default function GalleryStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: notebook.bg },
        headerShown: false,
      }}
    >
      <Stack.Screen name="GalleryHome" component={GalleryScreen} />
      <Stack.Screen name="GalleryArchive" component={GalleryArchiveScreen} />
    </Stack.Navigator>
  );
}

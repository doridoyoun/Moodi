import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export async function pickMemoPhoto() {
  const isWeb = Platform.OS === 'web';
  if (!isWeb) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Photo permission denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: isWeb,
    quality: 0.9,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const longestSide = Math.max(asset.width, asset.height);
  const resize = asset.width >= asset.height ? { width: 800 } : { height: 800 };

  try {
    const image = await ImageManipulator.manipulateAsync(
      asset.uri,
      longestSide > 800 ? [{ resize }] : [],
      { compress: 0.8, base64: isWeb, format: ImageManipulator.SaveFormat.JPEG },
    );
    if (isWeb) {
      if (image.base64) return `data:image/jpeg;base64,${image.base64}`;
      throw new Error('Photo data unavailable');
    }

    const source = new File(image.uri);
    const destination = new File(Paths.document, source.name);
    source.copy(destination);
    return destination.uri;
  } catch (error) {
    const mimeType = asset.mimeType || asset.file?.type;
    if (isWeb && asset.base64 && mimeType) return `data:${mimeType};base64,${asset.base64}`;
    throw error;
  }
}

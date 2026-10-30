import type * as ImagePicker from 'expo-image-picker';
import { MAX_PHOTO_CHARS } from '../../features/laundry/data/localLaundryStorage';

export type PhotoResult =
  | { status: 'ok'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'too-large' }
  | { status: 'error'; message: string };
export interface PhotoPicker {
  takePhoto(): Promise<PhotoResult>;
  pickFromLibrary(): Promise<PhotoResult>;
}

type PickerModule = Pick<typeof ImagePicker, 'requestCameraPermissionsAsync' | 'launchCameraAsync' | 'launchImageLibraryAsync'>;
const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.3, base64: true, allowsEditing: false };

export function toPhotoResult(result: ImagePicker.ImagePickerResult): PhotoResult {
  if (result.canceled) return { status: 'cancelled' };
  const asset = result.assets?.[0];
  if (!asset?.base64) return { status: 'error', message: 'Foto tidak dapat dibaca. Silakan coba lagi.' };
  const type = asset.mimeType && /^image\/(jpeg|png|webp)$/.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  const uri = `data:${type};base64,${asset.base64}`;
  return uri.length > MAX_PHOTO_CHARS ? { status: 'too-large' } : { status: 'ok', uri };
}

// Camera needs permission (asked on first use); the gallery uses the system picker, no permission.
export function createPhotoPicker(injected?: PickerModule): PhotoPicker {
  // Loaded on first use so the native module is not touched at startup (or in plain Node tests).
  const load = async (): Promise<PickerModule> => injected ?? await import('expo-image-picker');
  const guard = async (run: () => Promise<PhotoResult>): Promise<PhotoResult> => {
    try { return await run(); } catch { return { status: 'error', message: 'Kamera atau galeri tidak tersedia di perangkat ini.' }; }
  };
  return {
    takePhoto: () => guard(async () => {
      const picker = await load();
      const permission = await picker.requestCameraPermissionsAsync();
      if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };
      return toPhotoResult(await picker.launchCameraAsync(options));
    }),
    pickFromLibrary: () => guard(async () => toPhotoResult(await (await load()).launchImageLibraryAsync(options))),
  };
}

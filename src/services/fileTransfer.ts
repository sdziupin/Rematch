import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Native: writes the file to the cache and opens the share sheet (save to Files, AirDrop, email…). */
export async function saveTextFile(name: string, contents: string, mimeType = 'application/json'): Promise<'shared' | 'saved'> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Save your REMATCH backup', UTI: 'public.json' });
    return 'shared';
  }
  return 'saved';
}

/** Native: lets the athlete pick a backup file. Resolves null when cancelled. */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  return new File(result.assets[0].uri).text();
}

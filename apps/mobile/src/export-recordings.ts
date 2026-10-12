import { File, Paths } from 'expo-file-system';
import { Zip, ZipPassThrough } from 'fflate';
import * as Sharing from 'expo-sharing';
import type { Repository } from './repository';

export async function shareLocalRecordings(repo: Repository): Promise<void> {
  const output = new File(Paths.cache, 'down-and-up-recordings.zip');
  output.create({ overwrite: true });
  const writer = output.open();
  let archiveError: Error | null = null;
  let count = 0;
  const zip = new Zip((error, data) => {
    if (error) archiveError = error;
    else writer.writeBytes(data);
  });
  try {
    for (const entry of await repo.list()) {
      if (!entry.audioId) continue;
      const local = await repo.audio(entry.audioId);
      if (!local?.local_path) continue;
      const file = new File(local.local_path);
      if (!file.exists) continue;
      const stream = new ZipPassThrough(`${entry.date}.m4a`);
      zip.add(stream);
      count++;
      const reader = file.open();
      try {
        let read = 0;
        while (read < file.size) {
          const data = reader.readBytes(Math.min(64 * 1024, file.size - read));
          read += data.length;
          stream.push(data, read === file.size);
          if (archiveError) throw archiveError;
        }
      } finally {
        reader.close();
      }
    }
    zip.end();
    if (archiveError) throw archiveError;
  } finally {
    writer.close();
  }
  if (!count) {
    output.delete();
    throw new Error('No recordings are saved on this phone');
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is unavailable on this phone');
  await Sharing.shareAsync(output.uri, {
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
  });
}

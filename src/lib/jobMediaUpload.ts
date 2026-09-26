import { optimizeImageFile } from './imageOptimization';
import { ensureUserSession } from './userIdentity';
import {
  removeServiceMediaFiles, uploadServiceMediaFile, type UploadedServiceMedia,
} from './serviceMediaStorage';

export type UploadedJobMedia = UploadedServiceMedia;

export async function uploadJobImage(file: File): Promise<UploadedJobMedia> {
  const optimized = await optimizeImageFile(file, 1280, 1280, 0.78);
  const user = await ensureUserSession();
  return uploadServiceMediaFile(optimized, `jobs/${user.id}/images`, 'jpg');
}

export async function removeUploadedJobMedia(paths: string[]): Promise<void> {
  await removeServiceMediaFiles(paths);
}

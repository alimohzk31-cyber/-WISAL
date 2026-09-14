import { optimizeImageFile } from './imageOptimization';
import {
  removeServiceMediaFiles, uploadServiceMediaFile, type UploadedServiceMedia,
} from './serviceMediaStorage';

export type UploadedJobMedia = UploadedServiceMedia;

export async function uploadJobImage(file: File): Promise<UploadedJobMedia> {
  const optimized = await optimizeImageFile(file, 1280, 1280, 0.78);
  return uploadServiceMediaFile(optimized, 'jobs/images', 'jpg');
}

export async function uploadJobVideo(file: File): Promise<UploadedJobMedia> {
  return uploadServiceMediaFile(file, 'jobs/videos', 'mp4');
}

export async function removeUploadedJobMedia(paths: string[]): Promise<void> {
  await removeServiceMediaFiles(paths);
}

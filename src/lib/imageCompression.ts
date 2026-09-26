// Image compression presets per call site (T23, DUP-11). Wraps browser-image-compression; the
// only lib module allowed to import it. The presets are copied exactly from the call sites as they
// were after T14/T15 (useWebWorker: false everywhere: the library's worker loads its code from
// cdn.jsdelivr.net, which the CSP blocks).
import imageCompression from 'browser-image-compression';

export const COMPRESSION_PRESETS = {
  /** Spot photos (useSpotStore). */
  spot: { maxSizeMB: 0.3, maxWidthOrHeight: 1280, useWebWorker: false },
  /** Profile picture and banner, second pass in useUserStore. */
  profileStore: { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: false },
  /** Profile picture, first pass in SettingsPanel (kept: removing a pass changes output). */
  settingsProfilePicture: { maxSizeMB: 1, maxWidthOrHeight: 800, useWebWorker: false },
  /** Profile banner, first pass in SettingsPanel (kept: removing a pass changes output). */
  settingsBanner: { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: false },
  /** Feedback attachments (FeedbackPanel). */
  feedback: { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: false },
} as const;

export type CompressionPreset = keyof typeof COMPRESSION_PRESETS;

/**
 * Compresses `file` with a preset. `fileType` forces the output type (the stores retry with
 * 'image/jpeg' when the first output is a type the Storage rules reject, e.g. GIF).
 */
export function compressImage(file: File, preset: CompressionPreset, fileType?: string): Promise<File> {
  const options = COMPRESSION_PRESETS[preset];
  return imageCompression(file, fileType === undefined ? { ...options } : { ...options, fileType });
}

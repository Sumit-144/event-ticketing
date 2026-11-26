/** Public URL prefix under which stored uploads are served. */
export const UPLOADS_URL_PREFIX = '/uploads';

/** Subfolder (under UPLOAD_DEST) for event banners. */
export const EVENT_BANNER_SUBDIR = 'events';

/** Declared MIME types accepted by the cheap early filter. The real check is magic bytes. */
export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
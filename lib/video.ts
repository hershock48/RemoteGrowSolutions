/**
 * The canopy video. Jake, 2026-11-16: the grower records a video on the phone
 * and attaches it to the room's day, on the same form the runoff goes on, so
 * he can watch it.
 *
 * A phone video runs 30 to 200 MB and a request through the site's own server
 * stops near 4 MB, so the file goes from the phone straight to storage (Vercel
 * Blob, a client upload). The server's part is two checks. It signs a
 * short-lived permission for exactly one path (app/api/video/route.ts), and
 * afterwards it confirms the file is in OUR store under that path before the
 * address is written on the entry (attachVideo in app/f/actions.ts).
 *
 * This file is read by the browser and the server, so it holds no secrets and
 * imports nothing.
 */
export const VIDEO_MAX_MB = 300;

/** What a phone records: MP4 on Android, MOV on an iPhone, WebM from a desktop browser. */
export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** Some phones hand over a file with no type. The name's ending is the fallback. */
export function videoType(file: { type: string; name: string }): string | null {
  if (VIDEO_TYPES[file.type]) return file.type;
  const end = file.name.toLowerCase().split(".").pop() ?? "";
  const found = Object.entries(VIDEO_TYPES).find(([, ext]) => ext === end);
  if (found) return found[0];
  return end === "m4v" ? "video/mp4" : null;
}

export const videoPrefix = (slug: string, roomId: string, day: string) => `${slug}/${roomId}/${day}-video`;
export const videoPath = (slug: string, roomId: string, day: string, ext: string) => `${videoPrefix(slug, roomId, day)}.${ext}`;

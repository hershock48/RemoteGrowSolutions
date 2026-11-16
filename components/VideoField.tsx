"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { attachVideo, removeVideo } from "@/app/f/actions";
import { VIDEO_MAX_MB, VIDEO_TYPES, videoPath, videoType } from "@/lib/video";

/**
 * How long an upload may go without sending a single byte before it is called
 * off. The storage library retries a failing request ten times on its own,
 * which in the browser is many minutes of a bar that does not move, with the
 * Save button held the whole time. Rehearsed against storage answering 500.
 */
const STALL_MS = 45_000;

/**
 * The canopy video for one room and one day. See lib/video.ts.
 *
 * It uploads the moment it is picked and is kept on the day by itself, apart
 * from the Save button: a video is minutes of upload on a grow room's wifi,
 * and tying it to the form would lose the typed readings to one dropped
 * connection. The file input has no name on purpose, so the form never tries
 * to send the file through the server.
 *
 * `onBusy` lets the form hold its Save button while a video is going up,
 * because saving loads another page and would cut the upload off. `onSaved`
 * hands back the entry's new save time, so the form it sits in still counts
 * as up to date (see `seen` in saveCheckin).
 */
export default function VideoField({
  slug,
  roomId,
  day,
  enabled,
  initialUrl,
  onBusy,
  onSaved,
}: {
  slug: string;
  roomId: string;
  day: string;
  enabled: boolean;
  initialUrl?: string;
  onBusy: (busy: boolean) => void;
  onSaved: (at: number) => void;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [pct, setPct] = useState<number | null>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [working, setWorking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const stalled = useRef(false);

  const busy = (b: boolean) => {
    setWorking(b);
    onBusy(b);
  };

  async function send(file: File) {
    const type = videoType(file);
    if (!type) {
      setNote({ text: "That file is not a video this page can take. It takes MP4, MOV and WebM.", bad: true });
      return;
    }
    if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
      setNote({
        text: `That video is ${Math.round(file.size / 1048576)} MB and the limit is ${VIDEO_MAX_MB} MB. Record at 1080p instead of 4K, or keep it near 30 seconds.`,
        bad: true,
      });
      return;
    }
    busy(true);
    setPct(0);
    setNote(null);
    abort.current = new AbortController();
    stalled.current = false;
    let moved = Date.now();
    const watch = window.setInterval(() => {
      if (Date.now() - moved > STALL_MS) {
        stalled.current = true;
        abort.current?.abort();
      }
    }, 3000);
    try {
      const blob = await upload(videoPath(slug, roomId, day, VIDEO_TYPES[type]), file, {
        access: "public",
        handleUploadUrl: "/api/video",
        clientPayload: JSON.stringify({ slug, roomId, day }),
        contentType: type,
        // In parts, so one dropped part is sent again instead of the whole file.
        multipart: true,
        abortSignal: abort.current.signal,
        onUploadProgress: (e) => {
          moved = Date.now();
          setPct(Math.min(99, Math.round(e.percentage)));
        },
      });
      const res = await attachVideo({ slug, roomId, day, url: blob.url });
      if (!res.ok) {
        setNote({ text: res.error, bad: true });
        return;
      }
      setUrl(res.url);
      onSaved(res.at);
      setNote({ text: "The video is on this day. It is kept already, whether or not you press Save." });
    } catch (e) {
      if (stalled.current) setNote({ text: "The upload stalled, so it was stopped and nothing was attached. Check the connection and pick the video again.", bad: true });
      else if (abort.current?.signal.aborted) setNote({ text: "Upload stopped. Nothing was attached." });
      else {
        const why = e instanceof Error && e.message ? ` (${e.message.slice(0, 140)})` : "";
        setNote({ text: `The upload did not finish, so nothing was attached. Check the connection and pick the video again.${why}`, bad: true });
      }
    } finally {
      window.clearInterval(watch);
      setPct(null);
      busy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    busy(true);
    setNote(null);
    try {
      const res = await removeVideo({ slug, roomId, day });
      if (!res.ok) setNote({ text: res.error, bad: true });
      else {
        setUrl(null);
        onSaved(res.at);
        setNote({ text: "The video was taken off this day." });
      }
    } catch {
      setNote({ text: "That did not go through. Try again.", bad: true });
    } finally {
      busy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-line/60 pt-4">
      <label className="label" htmlFor="video">
        Canopy video, the whole room
      </label>
      {!enabled ? (
        <p className="text-sm text-muted">
          Video uploads are not switched on for this site yet. Send the video the way you do now and tick that line on the room page.
        </p>
      ) : (
        <>
          {url && (
            <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-bone">
              <span>A video is on this day.</span>
              <a href={url} target="_blank" rel="noopener" className="text-flare hover:underline">
                Watch it
              </a>
              <button
                type="button"
                onClick={remove}
                disabled={working}
                className="text-muted underline decoration-edge underline-offset-4 hover:text-bone disabled:opacity-50"
              >
                Remove it
              </button>
            </p>
          )}
          <input
            ref={input}
            id="video"
            type="file"
            accept="video/*"
            disabled={working}
            aria-describedby="video-hint video-note"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void send(file);
            }}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-edge file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-bone disabled:opacity-50"
          />
          <span id="video-hint" className="hint">
            About 30 seconds, walking the whole room. Up to {VIDEO_MAX_MB} MB. It uploads when you pick it and stays with this day.
            {url ? " A new one replaces the one that is here." : ""}
          </span>
          {pct !== null && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <progress value={pct} max={100} className="h-2 w-full max-w-xs" aria-label="Video upload" />
              <span className="text-sm text-bone">Uploading, {pct}%. Keep this page open.</span>
              <button
                type="button"
                onClick={() => abort.current?.abort()}
                className="text-sm text-muted underline decoration-edge underline-offset-4 hover:text-bone"
              >
                Stop
              </button>
            </div>
          )}
          <span id="video-note" role="status" className={note ? (note.bad ? "error" : "mt-2 block text-sm text-ok") : "sr-only"}>
            {note?.text ?? ""}
          </span>
        </>
      )}
    </div>
  );
}

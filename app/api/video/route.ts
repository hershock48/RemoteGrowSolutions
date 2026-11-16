import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { store } from "@/lib/store";
import { viewerFor } from "@/lib/auth";
import { isISODate, todayIn } from "@/lib/dates";
import { VIDEO_MAX_MB, VIDEO_TYPES, videoPath } from "@/lib/video";

/**
 * Signs the permission a phone needs to send one canopy video straight to
 * storage. See lib/video.ts for why the file does not pass through here.
 *
 * The permission is for one path only: this facility, this room, this day.
 * It is refused unless the person asking is signed in to that facility, the
 * room is theirs and the day has happened. It carries the size limit and the
 * three video types, which storage enforces, and it lasts an hour.
 *
 * Nothing is written to the entry here. The browser calls attachVideo once
 * the upload finishes, and that action checks the stored file itself.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Video uploads are not switched on for this site." }, { status: 503 });
  }
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Not a request this address takes." }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let p: Record<string, unknown> = {};
        try {
          p = JSON.parse(clientPayload ?? "{}") as Record<string, unknown>;
        } catch {
          /* handled by the checks below */
        }
        const slug = String(p.slug ?? "").toLowerCase().slice(0, 40);
        const roomId = String(p.roomId ?? "").slice(0, 40);
        const day = String(p.day ?? "").slice(0, 10);
        const facility = slug ? await store.facilityBySlug(slug) : null;
        if (!facility || !(await viewerFor(facility))) throw new Error("You are signed out. Sign in and pick the video again.");
        const room = await store.room(roomId);
        if (!room || room.facilityId !== facility.id) throw new Error("That room is not part of this facility.");
        if (!isISODate(day) || day > todayIn(facility.timezone)) throw new Error("That day has not happened yet.");
        const expected = Object.values(VIDEO_TYPES).some((ext) => pathname === videoPath(facility.slug, room.id, day, ext));
        if (!expected) throw new Error("That is not a video this page can take.");
        return {
          allowedContentTypes: Object.keys(VIDEO_TYPES),
          maximumSizeInBytes: VIDEO_MAX_MB * 1024 * 1024,
          // The stored address ends in characters nobody can work out from the ids.
          addRandomSuffix: true,
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The upload could not start." }, { status: 400 });
  }
}

import type { Metadata } from "next";
import Shell from "@/components/Shell";
import RoomForm from "@/components/RoomForm";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";

export const metadata: Metadata = { title: "Add a room" };

export default async function NewRoom({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ err?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility, viewer } = await requireFacility(slug);
  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
      <p className="eyebrow">New room</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Add a room</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        Equipment once, targets as they change. The emitter count and flow rate drive the runoff calculation on every
        check-in, so those two are worth getting right.
      </p>
      <div className="mt-8">
        <RoomForm slug={facility.slug} err={sp.err} />
      </div>
    </Shell>
  );
}

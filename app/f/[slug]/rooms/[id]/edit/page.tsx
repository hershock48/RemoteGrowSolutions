import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import RoomForm from "@/components/RoomForm";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";

export const metadata: Metadata = { title: "Edit room" };

export default async function EditRoom({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ err?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { facility, viewer } = await requireFacility(slug);
  const room = await store.room(id);
  if (!room || room.facilityId !== facility.id) notFound();
  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
      <p className="eyebrow">Edit</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{room.name}</h1>
      <div className="mt-8">
        <RoomForm slug={facility.slug} room={room} err={sp.err} />
      </div>
    </Shell>
  );
}

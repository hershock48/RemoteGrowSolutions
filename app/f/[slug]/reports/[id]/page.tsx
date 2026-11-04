import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, fmtDay } from "@/lib/dates";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Weekly report" };

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { facility, viewer } = await requireFacility(slug);
  const r = await store.report(id);
  if (!r || r.facilityId !== facility.id) notFound();
  if (r.status !== "approved" && viewer !== "rgs") notFound();
  const base = `/f/${facility.slug}`;

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/reports">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`${base}/reports`} className="text-sm text-muted hover:text-flare">
          All reports
        </Link>
        <div className="flex gap-2">
          {viewer === "rgs" && (
            <Link href={`${base}/reports/${r.id}/edit`} className="btn-ghost">
              Edit
            </Link>
          )}
        </div>
      </div>
      {sp.saved && (
        <p className="no-print mt-3 text-sm text-ok" role="status">
          Saved.
        </p>
      )}

      <article className="card mt-6 p-7 sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="eyebrow">{SITE.name} · weekly report</p>
            <h1 className="mt-2 text-3xl sm:text-4xl">{facility.name}</h1>
            <p className="mt-2 text-[15px] text-muted">
              Week of {fmtDay(r.weekOf, { month: "long", day: "numeric" })} to {fmtDay(addDays(r.weekOf, 6), { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <span className={`pill ${r.status === "approved" ? "text-ok" : "text-warn"}`}>
            {r.status === "approved" ? `Approved ${r.approvedAt ? new Date(r.approvedAt).toLocaleDateString("en-US") : ""}` : "Draft, not yet sent"}
          </span>
        </header>

        {r.note && (
          <section className="mt-8">
            <h2 className="text-lg text-bone">From your consultant</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-bone/90">{r.note}</p>
          </section>
        )}

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <Block title="Week behind" items={r.behind} />
          <Block title="Week ahead" items={r.ahead} />
        </div>

        <section className="mt-8">
          <h2 className="text-lg text-bone">Priority actions</h2>
          {r.actions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">None carried.</p>
          ) : (
            <table className="tbl mt-3">
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Owner</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                {r.actions.map((a, i) => (
                  <tr key={i}>
                    <td>{a.text}</td>
                    <td className="text-muted">{a.owner === "rgs" ? "RGS" : "Grower"}</td>
                    <td className="text-muted">{a.due ? fmtDay(a.due) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {r.exceptions.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg text-bone">KPI exceptions at the time of writing</h2>
            <ul className="mt-2 space-y-1.5 text-[15px] text-bone/90">
              {r.exceptions.map((x, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 dot dot-warn" aria-hidden="true" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">
          Targets are this facility&apos;s own, set at onboarding and on the weekly call. This report is yours to keep.
        </footer>
      </article>
    </Shell>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="text-lg text-bone">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing recorded.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-bone/90">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

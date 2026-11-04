import Link from "next/link";
import GlazedPlate from "./GlazedPlate";
import { SITE } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line/70 pt-10">
      <div className="wrap flex flex-wrap items-start justify-between gap-6 pb-10 text-sm text-muted">
        <div>
          <p className="font-display text-base font-bold text-bone">{SITE.name}</p>
          <p className="mt-1 max-w-sm">
            A service of{" "}
            <a href={SITE.parent.url} className="text-flare hover:underline">
              {SITE.parent.name}
            </a>
            , run by the director of a licensed Michigan cultivation facility.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/pricing" className="py-1 hover:text-flare">
            Pricing
          </Link>
          <Link href="/calculator" className="py-1 hover:text-flare">
            Irrigation calculator
          </Link>
          <Link href="/login" className="py-1 hover:text-flare">
            Client sign in
          </Link>
          <Link href="/admin" className="py-1 hover:text-flare">
            Consultant
          </Link>
        </nav>
      </div>
      <GlazedPlate line="Baked by" />
    </footer>
  );
}

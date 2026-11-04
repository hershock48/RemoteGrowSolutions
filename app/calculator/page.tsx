import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Calculator from "@/components/Calculator";

export const metadata: Metadata = {
  title: "Irrigation and runoff calculator",
  description:
    "Shot volume, daily feed volume, runoff percentage and net input from your emitter count, flow rate, shot length and shots per day. Free to use.",
};

export default function CalculatorPage() {
  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-24 pt-14 sm:pt-20">
        <p className="eyebrow">Free tool</p>
        <h1 className="mt-5 max-w-3xl text-[2.2rem] leading-[1.08] sm:text-5xl">Irrigation and runoff calculator</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-bone/85">
          Emitters, flow rate, shot length and shots per day give you the volume you are putting in. Measure what comes
          out and you have your runoff percentage. If EC and pH look wrong and the volume is also wrong, fix the volume
          first and read again before you touch the recipe.
        </p>
        <div className="mt-10">
          <Calculator />
        </div>
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
          Inside a subscription this runs on every check-in with the room&apos;s own emitter configuration filled in, so a
          grower types the runoff they collected and nothing else.
        </p>
      </main>
      <Footer />
    </>
  );
}

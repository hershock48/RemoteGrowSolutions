import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="wrap flex-1 pb-24 pt-14 sm:pt-20">
        <p className="eyebrow">404</p>
        <h1 className="mt-5 text-3xl sm:text-5xl">That page is not here</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          The address may have been typed wrong, or the page moved. The pricing, the calculator and the sign-in are a
          click away.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn-primary">
            Home
          </Link>
          <Link href="/pricing" className="btn-ghost">
            Pricing
          </Link>
          <Link href="/login" className="btn-ghost">
            Client sign in
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

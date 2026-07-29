import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t bg-[#0b1f3a] py-12 text-slate-300">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 text-sm sm:px-6 lg:grid-cols-[1.3fr_0.7fr_0.7fr] lg:px-8">
        <div>
          <Link href="/" className="text-lg font-semibold text-white">
            Cuadrabot
          </Link>
          <p className="mt-3 max-w-md leading-6">
            Self-serve construction takeoffs from scaled PDF plans, delivered
            in hours with marked evidence and downloadable quantities.
          </p>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            Takeoff support only. Not engineering, architectural, permit, or
            final-bid advice. Always verify quantities against the contract
            documents.
          </p>
        </div>
        <div>
          <p className="font-medium text-white">Product</p>
          <nav className="mt-4 flex flex-col gap-3">
            <Link href="/how-it-works">How it works</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/sample">Sample output</Link>
            <Link href="/accuracy">Accuracy</Link>
            <Link href="/security">Security</Link>
          </nav>
        </div>
        <div>
          <p className="font-medium text-white">Company</p>
          <nav className="mt-4 flex flex-col gap-3">
            <Link href="/faq">FAQ</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/refund-policy">Refund policy</Link>
            <a href="mailto:support@cuadrabot.com">Support</a>
          </nav>
        </div>
        <div className="border-t border-white/10 pt-6 text-xs text-slate-400 lg:col-span-3">
          © {new Date().getFullYear()} Cuadrabot. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

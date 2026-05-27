import Link from 'next/link'
import { ArrowRight, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(85,125,245,0.18),transparent_32%),linear-gradient(180deg,#f9f5eb_0%,#eef3fb_100%)] px-6 py-10">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-white/60 bg-[rgba(252,252,252,0.76)] p-8 shadow-[0_30px_100px_rgba(31,42,54,0.14)] backdrop-blur-xl md:p-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#557df5]/30 bg-[#557df5]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3552b3]">
          <Sparkles className="h-3.5 w-3.5" /> King CRM Hub
        </div>

        <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.03em] text-[#1f2a36] md:text-6xl">
          Insurance CRM built for operators who execute at elite level.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#1f2a36]/70">
          Run pipeline, lead follow-up, team accountability, and AI-assisted production in one command center.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: TrendingUp, title: 'Pipeline command center', desc: 'Track revenue velocity and stage movement in real time.' },
            { icon: ShieldCheck, title: 'Secure operations', desc: 'Session controls, role boundaries, and audited activity history.' },
            { icon: Sparkles, title: 'AI execution assist', desc: 'Smart suggestions for next action, follow-up, and prioritization.' },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-[rgba(31,42,54,0.1)] bg-white/80 p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#557df5]/12 text-[#3552b3]">
                <item.icon className="h-5 w-5" />
              </div>
              <p className="text-lg font-semibold text-[#1f2a36]">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#1f2a36]/65">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/auth"
            className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(85,125,245,0.28)]"
          >
            Sign in <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link href="/auth" className="inline-flex items-center rounded-2xl border border-[rgba(31,42,54,0.15)] bg-white px-6 py-3 text-sm font-semibold text-[#1f2a36]">
            Create workspace
          </Link>
        </div>
      </div>
    </main>
  )
}

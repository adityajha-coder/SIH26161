'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function ScenarioRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <div className="flex h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-3 rounded-2xl border border-white/8 bg-[#0C0C0C] p-6 text-center shadow-xl">
        <div className="size-2 rounded-full bg-white mx-auto" />
        <h2 className="text-base font-semibold text-white">Digital Twin Studio Unified</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The breach scenario configuration engine is now fully integrated into the main Digital Twin Studio dashboard with live hydrodynamics and interactive 3D simulation.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
          >
            Launch Studio <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

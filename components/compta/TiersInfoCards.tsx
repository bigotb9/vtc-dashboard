"use client"

/**
 * 2 cards Contact + Entreprise sur la page détail tiers (Phase 4.x Vague 2 §3.4).
 */

import { Phone, Mail, MapPin, Building2, Hash, FileText } from "lucide-react"
import type { TiersDetail } from "@/types/compta-ui"

type Props = {
  detail: TiersDetail
}

export function TiersInfoCards({ detail }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Contact" accent="indigo">
        <Row Icon={Phone}  label="Téléphone">{detail.telephone ? <span className="font-mono">{detail.telephone}</span> : "—"}</Row>
        <Row Icon={Mail}   label="Email">{detail.email      ? <span className="font-mono">{detail.email}</span>      : "—"}</Row>
        <Row Icon={MapPin} label="Adresse">{detail.adresse ?? "—"}</Row>
      </Card>
      <Card title="Données entreprise" accent="violet">
        <Row Icon={Building2} label="Raison sociale">{detail.raison_sociale       ?? "—"}</Row>
        <Row Icon={Hash}      label="N° RCCM">       {detail.numero_rccm          ? <span className="font-mono">{detail.numero_rccm}</span> : "—"}</Row>
        <Row Icon={FileText}  label="N° contribuable">{detail.numero_contribuable ? <span className="font-mono">{detail.numero_contribuable}</span> : "—"}</Row>
      </Card>
    </div>
  )
}

const ACCENT: Record<string, string> = {
  indigo: "from-indigo-500 to-violet-600",
  violet: "from-violet-500 to-fuchsia-600",
}

function Card({ title, accent, children }: { title: string; accent: keyof typeof ACCENT; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${ACCENT[accent]}`} />
      <div className="p-4">
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-2.5">
          {title}
        </h3>
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  )
}

function Row({ Icon, label, children }: { Icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center shrink-0">
        <Icon size={12} className="text-gray-500 dark:text-gray-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</div>
        <div className="text-sm text-gray-900 dark:text-white mt-0.5 break-words">{children}</div>
      </div>
    </div>
  )
}

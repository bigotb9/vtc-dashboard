"use client"

/**
 * components/cockpit/CockpitAlertes.tsx
 *
 * Zone 2 — Cockpit Boyah : liste des alertes à traiter aujourd'hui.
 *
 * - Tri par niveau (critique > attention > positive)
 * - Max 5 affichées par défaut, bouton "Afficher tout (X)"
 * - Bouton "Fait" par alerte → persistance localStorage (alertes_traitees_<jour>)
 * - Action selon type :
 *     retard_vehicule + contacts → modal contacts WhatsApp
 *     retard_vehicule sans contacts → /recettes/suivi
 *     caisse_negative → href fourni
 *     top_performer → message du conversation associé (best-effort)
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Sparkles, Eye, MessageCircle, Check } from "lucide-react"
import { toast } from "@/lib/toast"
import ContactsModal from "./ContactsModal"
import type { Alerte, AlerteNiveau, Conversation } from "./types"

const LS_KEY_PREFIX = "cockpit_alertes_traitees_"
const NIVEAU_ORDER: Record<AlerteNiveau, number> = {
  critique:  0,
  attention: 1,
  positive:  2,
}
const DEFAULT_VISIBLES = 5

type Props = {
  alertes:       Alerte[]
  conversations: Conversation[]   // pour félicitations (récupération message + contacts)
  loading:       boolean
  error:         string | null
}

export default function CockpitAlertes({ alertes, conversations, loading, error }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const lsKey = `${LS_KEY_PREFIX}${today}`

  const [traites,  setTraites]  = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [modalContacts, setModalContacts] = useState<{
    titre: string
    contacts: { nom: string; numero: string }[]
    message?: string
  } | null>(null)

  // Charger les alertes traitées du jour
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey)
      if (raw) setTraites(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
  }, [lsKey])

  const markFait = (id: string) => {
    setTraites(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(lsKey, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
      return next
    })
  }

  // Tri (non traités d'abord par criticité, traités en fin)
  const sortees = useMemo(() => {
    return [...alertes].sort((a, b) => {
      const aFait = traites.has(a.id) ? 1 : 0
      const bFait = traites.has(b.id) ? 1 : 0
      if (aFait !== bFait) return aFait - bFait
      return NIVEAU_ORDER[a.niveau] - NIVEAU_ORDER[b.niveau]
    })
  }, [alertes, traites])

  const visibles = expanded ? sortees : sortees.slice(0, DEFAULT_VISIBLES)
  const activesCount = sortees.filter(a => !traites.has(a.id)).length

  // Pour les top_performer, on cherche dans les conversations celle avec un id
  // qui contient le nom du chauffeur (felicitation:YYYY-MM-DD:<nom>).
  const findFelicitation = (alerte: Alerte): Conversation | undefined => {
    if (alerte.type !== "top_performer") return undefined
    const nom = alerte.titre.split(" explose")[0]?.trim()
    if (!nom) return undefined
    return conversations.find(c => c.type === "felicitation" && c.titre.includes(nom))
  }

  if (error) {
    return (
      <Section title="À traiter aujourd'hui" badge={null}>
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
          Erreur alertes : {error}
        </div>
      </Section>
    )
  }

  if (loading) {
    return (
      <Section title="À traiter aujourd'hui" badge={null}>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </Section>
    )
  }

  return (
    <Section title="À traiter aujourd'hui" badge={activesCount}>
      {sortees.length === 0 ? (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200/60 dark:border-emerald-500/20">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            Aucune alerte aujourd&apos;hui 🎉
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {visibles.map(a => (
              <AlerteRow
                key={a.id}
                alerte={a}
                fait={traites.has(a.id)}
                onFait={() => markFait(a.id)}
                onOpenContacts={(titre, contacts, message) => setModalContacts({ titre, contacts, message })}
                felicitation={findFelicitation(a)}
              />
            ))}
          </ul>

          {sortees.length > DEFAULT_VISIBLES && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {expanded ? "Réduire" : `Afficher tout (${sortees.length})`}
            </button>
          )}
        </>
      )}

      {modalContacts && (
        <ContactsModal
          open={true}
          onClose={() => setModalContacts(null)}
          titre={modalContacts.titre}
          contacts={modalContacts.contacts}
          message={modalContacts.message}
        />
      )}
    </Section>
  )
}

function Section({ title, badge, children }: {
  title: string
  badge: number | null
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </h2>
          {badge != null && badge > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] font-bold tabular-nums">
              {badge}
            </span>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function AlerteRow({ alerte, fait, onFait, onOpenContacts, felicitation }: {
  alerte:        Alerte
  fait:          boolean
  onFait:        () => void
  onOpenContacts: (titre: string, contacts: { nom: string; numero: string }[], message?: string) => void
  felicitation?: Conversation
}) {
  const dotColor =
    alerte.niveau === "critique"  ? "bg-red-500" :
    alerte.niveau === "attention" ? "bg-amber-500" :
                                    "bg-emerald-500"

  const iconColor =
    alerte.niveau === "critique"  ? "text-red-500" :
    alerte.niveau === "attention" ? "text-amber-500" :
                                    "text-emerald-500"

  const Icon = alerte.niveau === "positive" ? Sparkles : AlertTriangle

  // Détermine l'action principale
  const renderAction = () => {
    const whatsapp = alerte.actions.find(a => a.type === "whatsapp")
    const voir     = alerte.actions.find(a => a.type === "voir")

    if (whatsapp && whatsapp.contacts && whatsapp.contacts.length > 0) {
      return (
        <button
          onClick={() => onOpenContacts(alerte.titre, whatsapp.contacts ?? [])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shrink-0"
        >
          <MessageCircle size={12} />
          {whatsapp.label}
        </button>
      )
    }

    if (alerte.type === "top_performer") {
      // top_performer : message non fourni dans l'alerte, on récupère via conversations
      if (felicitation && felicitation.contacts.length > 0) {
        return (
          <button
            onClick={() => onOpenContacts(alerte.titre, felicitation.contacts, felicitation.message)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shrink-0"
          >
            <MessageCircle size={12} />
            Féliciter par WhatsApp
          </button>
        )
      }
      return (
        <button
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-white/5 text-gray-400 text-xs font-bold cursor-not-allowed shrink-0"
          title="Numéro chauffeur introuvable"
        >
          <MessageCircle size={12} />
          Féliciter
        </button>
      )
    }

    if (voir) {
      return (
        <Link
          href={voir.href ?? "#"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition shrink-0"
        >
          <Eye size={12} />
          {voir.label}
        </Link>
      )
    }

    return null
  }

  return (
    <li
      className={`flex items-start gap-3 p-3 rounded-xl border transition ${
        fait
          ? "opacity-45 border-gray-100 dark:border-[#1E2D45] bg-gray-50/40 dark:bg-white/[0.01]"
          : "border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] hover:shadow-sm"
      }`}
    >
      <div className="pt-0.5 flex flex-col items-center gap-1.5 shrink-0">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <Icon size={12} className={`${iconColor} opacity-60`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {alerte.titre}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          {alerte.meta}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!fait && renderAction()}
        <button
          onClick={() => {
            onFait()
            toast.success("Alerte marquée comme traitée")
          }}
          disabled={fait}
          title={fait ? "Déjà traitée" : "Marquer comme traitée"}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
            fait
              ? "bg-gray-100 dark:bg-white/5 text-gray-400 cursor-default"
              : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
          }`}
        >
          <Check size={12} />
          {fait ? "Fait" : "Fait"}
        </button>
      </div>
    </li>
  )
}

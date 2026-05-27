"use client"

/**
 * components/cockpit/ContactsModal.tsx
 *
 * Liste des chauffeurs à contacter avec leur numéro WhatsApp.
 * Chaque entrée a un bouton qui ouvre wa.me dans un nouvel onglet.
 */

import { MessageCircle } from "lucide-react"
import ModalShell from "@/components/ModalShell"
import type { AlerteContact } from "./types"

type Props = {
  open:     boolean
  onClose:  () => void
  titre:    string
  contacts: AlerteContact[]
  message?: string
}

/** Normalise un numéro pour wa.me : retire +, espaces, tirets, parenthèses. */
function toWaUrl(numero: string, message?: string): string {
  const clean = numero.replace(/[^0-9]/g, "")
  // Numéros CI sans préfixe → forcer 225
  const final = clean.length === 10 ? `225${clean}` : clean
  const base = `https://wa.me/${final}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export default function ContactsModal({ open, onClose, titre, contacts, message }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title={titre} subtitle={`${contacts.length} chauffeur(s)`} size="md">
      {contacts.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucun contact disponible.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c, idx) => (
            <li
              key={`${c.nom}-${idx}`}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 dark:border-[#1E2D45] bg-gray-50/50 dark:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.nom}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{c.numero}</p>
              </div>
              <a
                href={toWaUrl(c.numero, message)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shrink-0"
              >
                <MessageCircle size={13} />
                WhatsApp
              </a>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  )
}

"use client"

/**
 * Aperçu temps réel de l'écriture comptable SYSCOHADA (Écran 4 Phase 3).
 *
 * Reproduit côté UI la logique backend `genererEcritureFromOperation` :
 *  - Entrée  : caisse débitée + catégorie créditée
 *  - Sortie  : catégorie débitée + caisse créditée
 *
 * Cet aperçu est PURELY visuel. La VRAIE écriture est créée côté serveur au
 * moment du Valider. Si un champ obligatoire manque, on affiche un placeholder.
 *
 * Référence : doc Phase 3 Écran 4 §3.4.
 */

import { Eye, CheckCircle, Sparkles } from "lucide-react"
import type {
  TypeOperation,
  CaisseRefForm,
  CategorieForm,
} from "@/types/compta-ui"
import { formatMontant } from "@/lib/format/montant"

// Lot S (audit 27/05/2026) : helper centralise via @/lib/format/montant
const fmt = formatMontant

type Props = {
  type:       TypeOperation
  montant:    number | null
  caisse:     CaisseRefForm | null
  categorie:  CategorieForm | null
  /** Mode actif du module compta (récupéré du backend). Si "simple", on cache
   *  ou affiche un placeholder explicatif. Si undefined, on considère "avance"
   *  (par défaut). */
  modeActif?: "simple" | "avance"
  libelleOp?: string
}

type LigneView = {
  code:     string
  libelle:  string
  debit:    number
  credit:   number
}

function buildPreview(
  type:      TypeOperation,
  montant:   number,
  caisse:    CaisseRefForm,
  categorie: CategorieForm,
): { journal: string; lignes: LigneView[] } {
  const codeCaisse    = caisse.compte_syscohada_code     ?? "?"
  const codeCategorie = categorie.compte_syscohada_code  ?? "?"
  const libCaisse     = caisse.compte_syscohada_libelle  ?? caisse.libelle
  const libCategorie  = categorie.compte_syscohada_libelle ?? categorie.libelle
  const journal       = categorie.journal_par_defaut ?? "OD"

  if (type === "entree") {
    return {
      journal,
      lignes: [
        { code: codeCaisse,    libelle: libCaisse,    debit: montant, credit: 0       },
        { code: codeCategorie, libelle: libCategorie, debit: 0,       credit: montant },
      ],
    }
  }
  return {
    journal,
    lignes: [
      { code: codeCategorie, libelle: libCategorie, debit: montant, credit: 0       },
      { code: codeCaisse,    libelle: libCaisse,    debit: 0,       credit: montant },
    ],
  }
}

export function EcriturePreview({ type, montant, caisse, categorie, modeActif = "avance", libelleOp }: Props) {
  // Mode Simple : pas d'écriture comptable générée
  if (modeActif === "simple") {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300/70 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.015] px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-white/[0.05] flex items-center justify-center text-gray-400 flex-shrink-0">
            <Eye size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Mode Simple actif</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
              Aucune écriture comptable SYSCOHADA ne sera générée. Bascule en mode
              Avancé pour activer la double-écriture.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const ready = montant != null && montant > 0 && caisse != null && categorie != null

  if (!ready) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-400/30 dark:border-violet-500/20 bg-violet-500/[0.025] dark:bg-violet-500/[0.04] px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 flex-shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">Aperçu écriture SYSCOHADA</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
              Renseignez le montant, la caisse et la catégorie pour voir l&apos;aperçu
              de l&apos;écriture comptable qui sera générée.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { journal, lignes } = buildPreview(type, montant, caisse, categorie)
  const totalDebit  = lignes.reduce((s, l) => s + l.debit,  0)
  const totalCredit = lignes.reduce((s, l) => s + l.credit, 0)
  const equilibree  = totalDebit === totalCredit

  return (
    <div className="rounded-2xl border-2 border-dashed border-violet-400/40 dark:border-violet-500/30 bg-violet-500/[0.025] dark:bg-violet-500/[0.05] overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-violet-500/30 flex-shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
                Aperçu écriture SYSCOHADA
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Journal <span className="font-mono font-bold text-violet-600 dark:text-violet-400">{journal}</span> · Mode Avancé · sera créée au moment du Valider
              </p>
            </div>
          </div>
        </div>

        {libelleOp && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic mb-2.5 pl-12 truncate">
            « {libelleOp} »
          </p>
        )}

        <div className="rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400">
              <tr className="text-[10px] font-bold uppercase tracking-wider">
                <th className="text-left  px-3 py-1.5 w-[80px]">Code</th>
                <th className="text-left  px-3 py-1.5">Libellé</th>
                <th className="text-right px-3 py-1.5 w-[100px]">Débit</th>
                <th className="text-right px-3 py-1.5 w-[100px]">Crédit</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-white/[0.04]">
                  <td className="px-3 py-2">
                    <span className="font-mono text-[10.5px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded font-bold">
                      {l.code}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                    {l.libelle}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {l.debit > 0 ? (
                      <span className="font-bold text-gray-900 dark:text-white">{fmt(l.debit)}</span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {l.credit > 0 ? (
                      <span className="font-bold text-gray-900 dark:text-white">{fmt(l.credit)}</span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.02]">
                <td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Totaux
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold text-gray-900 dark:text-white">{fmt(totalDebit)}</td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold text-gray-900 dark:text-white">{fmt(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={`mt-3 rounded-lg px-3 py-2 flex items-center gap-2 ${
          equilibree
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-red-500/10 text-red-700 dark:text-red-300"
        }`}>
          <CheckCircle size={14} className={equilibree ? "text-emerald-500" : "text-red-500"} />
          <span className="text-[11px] font-bold tabular-nums">
            Δ = {fmt(totalDebit - totalCredit)} FCFA
            {equilibree ? " · écriture équilibrée" : " · DÉSÉQUILIBRE"}
          </span>
        </div>
      </div>
    </div>
  )
}

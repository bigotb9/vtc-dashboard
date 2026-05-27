"use client"

/**
 * components/ModalShell.tsx
 *
 * Wrapper de modal unifie pour Fleet (Lot P 26/05/2026 audit) :
 *   - ferme avec Escape
 *   - ferme au clic backdrop (en dehors du panneau)
 *   - bouton ✕ en haut a droite
 *   - aria-modal + aria-labelledby pour lecteurs d'ecran
 *   - tailles sm / md / lg / xl
 *   - le footer est un slot separe (pour barre boutons standard)
 *
 * Usage :
 *   <ModalShell open={open} onClose={onClose} title="Titre" subtitle="..." size="md"
 *     footer={<><button>Annuler</button><button>OK</button></>}>
 *     <div>Contenu du formulaire ici</div>
 *   </ModalShell>
 */

import { useEffect, useRef, useId } from "react"
import { X } from "lucide-react"

export type ModalSize = "sm" | "md" | "lg" | "xl"

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
}

type Props = {
  open:      boolean
  onClose:   () => void
  title:     string
  subtitle?: string
  children:  React.ReactNode
  footer?:   React.ReactNode
  size?:     ModalSize
  /** Si true, le clic backdrop est desactive (cas modals de confirmation critique). Default false. */
  noBackdropClose?: boolean
}

export default function ModalShell({
  open, onClose, title, subtitle, children, footer,
  size = "md", noBackdropClose = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId  = useId()

  // Ferme avec Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Focus le panneau au mount pour que Escape capture immediatement
  useEffect(() => {
    if (open && panelRef.current) panelRef.current.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => { if (!noBackdropClose) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] w-full ${SIZE_CLASSES[size]} shadow-2xl outline-none`}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#1E2D45]">
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5 transition shrink-0 ml-2"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-5 pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

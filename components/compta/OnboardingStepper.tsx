"use client"

/**
 * Stepper avec 4 dots (Écran 9 §2.2).
 * - inactif : 7×7px, fond rgba(255,255,255,0.10)
 * - actif   : 22×7px, vert #10B981, glow
 * - terminé : 7×7px, vert semi-transparent rgba(16,185,129,0.5)
 * Transition 0.2s.
 */

type Props = {
  current: 1 | 2 | 3 | 4
  total?:  number
  /** Label sous le stepper, ex: "Étape 2 — Choix du mode". */
  label?:  string
}

export function OnboardingStepper({ current, total = 4, label }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex items-center gap-2" aria-label={`Étape ${current} sur ${total}`}>
        {Array.from({ length: total }).map((_, i) => {
          const idx = i + 1
          const isActive = idx === current
          const isDone   = idx < current
          return (
            <span
              key={i}
              className="rounded-full transition-all duration-200"
              style={{
                width:      isActive ? 22 : 7,
                height:     7,
                background: isActive
                  ? "#10B981"
                  : isDone
                    ? "rgba(16,185,129,0.5)"
                    : "rgba(148,163,184,0.25)",
                boxShadow:  isActive ? "0 0 8px rgba(16,185,129,0.55)" : "none",
              }}
            />
          )
        })}
      </div>
      {label && (
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {label}
        </p>
      )}
    </div>
  )
}

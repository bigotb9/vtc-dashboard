"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react"
import { toastStore, Toast } from "@/lib/toast"

const CONFIG = {
  success: { icon: CheckCircle2, bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-white dark:bg-[#0D1424] border-emerald-200 dark:border-emerald-500/30" },
  error:   { icon: XCircle,      bar: "bg-red-500",     text: "text-red-700 dark:text-red-400",         bg: "bg-white dark:bg-[#0D1424] border-red-200 dark:border-red-500/30" },
  info:    { icon: Info,         bar: "bg-indigo-500",  text: "text-indigo-700 dark:text-indigo-400",   bg: "bg-white dark:bg-[#0D1424] border-indigo-200 dark:border-indigo-500/30" },
  warning: { icon: AlertTriangle, bar: "bg-amber-500",  text: "text-amber-700 dark:text-amber-400",     bg: "bg-white dark:bg-[#0D1424] border-amber-200 dark:border-amber-500/30" },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const c    = CONFIG[toast.type]
  const Icon = c.icon
  const [width, setWidth] = useState(100)

  useEffect(() => {
    const start = Date.now()
    const tick  = () => {
      const elapsed = Date.now() - start
      setWidth(Math.max(0, 100 - (elapsed / toast.duration) * 100))
      if (elapsed < toast.duration) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [toast.duration])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`relative w-80 rounded-2xl border shadow-xl overflow-hidden ${c.bg}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon size={16} className={`${c.text} flex-shrink-0 mt-0.5`} />
        <p className="text-sm text-gray-800 dark:text-gray-200 flex-1 leading-snug">{toast.message}</p>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex-shrink-0 mt-0.5"
        >
          <X size={13} />
        </button>
      </div>
      {/* barre de progression */}
      <div
        className={`h-0.5 ${c.bar} transition-all duration-100 ease-linear`}
        style={{ width: `${width}%` }}
      />
    </motion.div>
  )
}

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => toastStore.subscribe(setToasts), [])

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={() => toastStore.remove(t.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

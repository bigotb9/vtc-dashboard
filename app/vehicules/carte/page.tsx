"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, RefreshCw, Maximize2, Wifi, WifiOff } from "lucide-react"
import { motion } from "framer-motion"

const GPS_URL = "https://www.gps-go.com"

export default function GpsCartePage() {
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [key,      setKey]      = useState(0) // force iframe reload

  const reload = () => { setLoading(true); setError(false); setKey(k => k + 1) }

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-[#070B12]" : "h-[calc(100vh-4rem)]"}`}>

      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-[#0D1424] border-b border-gray-100 dark:border-[#1E2D45] flex-shrink-0 ${fullscreen ? "px-6" : ""}`}>
        <div className="flex items-center gap-3">
          {!fullscreen && (
            <Link href="/vehicules"
              className="flex items-center justify-center w-8 h-8 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-gray-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition">
              <ArrowLeft size={15} />
            </Link>
          )}

          {/* Dot live */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex w-2.5 h-2.5">
              {!error && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />}
              <span className={`relative inline-flex rounded-full w-2.5 h-2.5 ${error ? "bg-red-500" : "bg-emerald-500"}`} />
            </span>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">GPS Live — Boyah Group</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {error ? "Connexion impossible" : loading ? "Chargement…" : "12 véhicules · gps-go.com"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Status badge */}
          <span className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
            error
              ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
              : loading
              ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
              : "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
          }`}>
            {error ? <WifiOff size={10} /> : <Wifi size={10} />}
            {error ? "Hors ligne" : loading ? "Connexion…" : "En ligne"}
          </span>

          <button onClick={reload} title="Recharger"
            className="p-2 rounded-xl text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Réduire" : "Plein écran"}
            className="p-2 rounded-xl text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition">
            <Maximize2 size={14} />
          </button>

          <a href={GPS_URL} target="_blank" rel="noopener noreferrer" title="Ouvrir dans un nouvel onglet"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#1E2D45] hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition">
            <ExternalLink size={12} />
            <span className="hidden sm:inline">Ouvrir</span>
          </a>
        </div>
      </div>

      {/* iFrame zone */}
      <div className="relative flex-1 overflow-hidden bg-[#0A0E1A]">

        {/* Loading overlay */}
        {loading && !error && (
          <motion.div
            initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
          >
            <div className="relative">
              <span className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin block" />
              <span className="absolute inset-0 w-12 h-12 border-2 border-emerald-500/10 border-b-emerald-500 rounded-full animate-spin block" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
            <p className="text-sm text-gray-400 font-medium">Connexion à gps-go.com…</p>
            <p className="text-[11px] text-gray-600">Connecte-toi si demandé</p>
          </motion.div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 flex items-center justify-center">
              <WifiOff size={24} className="text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white mb-1">Impossible d&apos;afficher la carte</p>
              <p className="text-[12px] text-gray-500 max-w-xs">
                gps-go.com bloque l&apos;affichage dans cette fenêtre. Ouvre-le directement dans un nouvel onglet.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={reload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-300 hover:text-white transition">
                <RefreshCw size={13} /> Réessayer
              </button>
              <a href={GPS_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm text-white font-semibold transition shadow-lg shadow-indigo-500/25">
                <ExternalLink size={13} /> Ouvrir gps-go.com
              </a>
            </div>
          </div>
        )}

        {/* The iframe */}
        <iframe
          key={key}
          src={GPS_URL}
          className={`w-full h-full border-0 transition-opacity duration-500 ${loading || error ? "opacity-0" : "opacity-100"}`}
          title="GPS Live — Boyah Group"
          allow="geolocation"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true) }}
        />
      </div>
    </div>
  )
}

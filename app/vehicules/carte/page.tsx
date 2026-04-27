"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft, ExternalLink, RefreshCw, Maximize2, Minimize2,
  Wifi, WifiOff, MapPin, Car, ChevronRight, Clock, X
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabaseClient"

const GPS_URL = "https://www.gps-go.com"

type Vehicule = {
  id_vehicule: number
  immatriculation: string
  statut: string
  type_vehicule?: string
}

// ── Live dot ──────────────────────────────────────────────────────────────────
function LiveDot({ active = true, size = "sm" }: { active?: boolean; size?: "sm" | "md" }) {
  const s = size === "md" ? "w-3 h-3" : "w-2 h-2"
  if (!active) return <span className={`${s} rounded-full bg-gray-600 flex-shrink-0`} />
  return (
    <span className={`relative flex ${s} flex-shrink-0`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60`} />
      <span className={`relative inline-flex rounded-full ${s} bg-emerald-500`} />
    </span>
  )
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────
function ElapsedTimer({ since }: { since: Date | null }) {
  const [elapsed, setElapsed] = useState("—")
  useEffect(() => {
    if (!since) return
    const update = () => {
      const s = Math.floor((Date.now() - since.getTime()) / 1000)
      if (s < 60) setElapsed(`${s}s`)
      else if (s < 3600) setElapsed(`${Math.floor(s / 60)}m ${s % 60}s`)
      else setElapsed(`${Math.floor(s / 3600)}h`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [since])
  return <span>{elapsed}</span>
}

export default function GpsCartePage() {
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showPanel,  setShowPanel]  = useState(false)
  const [key,        setKey]        = useState(0)
  const [loadedAt,   setLoadedAt]   = useState<Date | null>(null)
  const [vehicules,  setVehicules]  = useState<Vehicule[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Fetch vehicles from Supabase
  useEffect(() => {
    supabase.from("vehicules")
      .select("id_vehicule, immatriculation, statut, type_vehicule")
      .eq("statut", "ACTIF")
      .order("immatriculation")
      .then(({ data }) => setVehicules(data || []))
  }, [])

  // ESC to exit fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && fullscreen) setFullscreen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen])

  const reload = useCallback(() => {
    setLoading(true); setError(false); setLoadedAt(null); setKey(k => k + 1)
  }, [])

  const onLoad = () => { setLoading(false); setLoadedAt(new Date()) }

  const actifs  = vehicules.length
  const loading_ = loading && !error

  return (
    <motion.div
      animate={{ borderRadius: fullscreen ? 0 : 16 }}
      className={`flex flex-col overflow-hidden bg-[#070B12] ${
        fullscreen
          ? "fixed inset-0 z-50"
          : "h-[calc(100vh-5rem)] rounded-2xl border border-[#1E2D45]"
      }`}
      style={{ boxShadow: fullscreen ? "none" : "0 8px 40px -12px rgba(0,0,0,0.6)" }}
    >
      {/* ── ACCENT BAR ──────────────────────────────────────────────────────── */}
      <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 flex-shrink-0" />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#0D1424] border-b border-[#1E2D45] flex-shrink-0">

        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {!fullscreen && (
            <Link href="/vehicules"
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl border border-[#1E2D45] text-gray-500 hover:text-indigo-400 hover:border-indigo-500/40 transition">
              <ArrowLeft size={14} />
            </Link>
          )}

          {/* Title + live dot */}
          <div className="flex items-center gap-2.5 min-w-0">
            <LiveDot active={!error && !loading_} size="md" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white leading-tight tracking-tight">GPS Live</p>
              <p className="text-[10px] text-gray-500 leading-tight hidden sm:block">
                {error ? "Connexion impossible"
                  : loading_ ? "Connexion à gps-go.com…"
                  : "Boyah Group · temps réel"}
              </p>
            </div>
          </div>

          {/* Stats chips */}
          {!loading_ && !error && (
            <div className="hidden md:flex items-center gap-2 ml-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <Car size={9} /> {actifs} actifs
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#1A2235] text-gray-400 ring-1 ring-white/5">
                <Clock size={9} />
                <ElapsedTimer since={loadedAt} />
              </span>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Vehicle panel toggle */}
          <button onClick={() => setShowPanel(p => !p)} title="Liste des véhicules"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition ${
              showPanel
                ? "bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30"
                : "text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10"
            }`}>
            <MapPin size={13} />
            <span className="hidden sm:inline">{actifs} véh.</span>
          </button>

          <div className="w-px h-4 bg-[#1E2D45] mx-0.5" />

          <button onClick={reload} title="Recharger"
            className="p-2 rounded-xl text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition">
            <RefreshCw size={13} className={loading_ ? "animate-spin text-indigo-400" : ""} />
          </button>

          <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Réduire (Esc)" : "Plein écran"}
            className="p-2 rounded-xl text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition">
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          <a href={GPS_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-gray-400 border border-[#1E2D45] hover:text-indigo-400 hover:border-indigo-500/40 transition">
            <ExternalLink size={12} />
            <span className="hidden sm:inline">gps-go.com</span>
          </a>
        </div>
      </div>

      {/* ── BODY — iframe + sliding panel ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Iframe */}
        <div className="relative flex-1 overflow-hidden">

          {/* Loading overlay */}
          <AnimatePresence>
            {loading_ && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5"
                style={{ background: "radial-gradient(ellipse 60% 60% at 50% 40%, rgba(99,102,241,0.06), transparent)" }}
              >
                {/* Spinner double */}
                <div className="relative w-16 h-16">
                  <span className="absolute inset-0 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="absolute inset-2 border-2 border-emerald-500/15 border-b-emerald-400 rounded-full animate-spin"
                    style={{ animationDirection: "reverse", animationDuration: "1.4s" }} />
                  <span className="absolute inset-[18px] border border-teal-500/20 border-r-teal-400 rounded-full animate-spin"
                    style={{ animationDuration: "0.8s" }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-300 mb-1">Connexion GPS en cours…</p>
                  <p className="text-[11px] text-gray-600">Connecte-toi à ton compte si demandé</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error overlay */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-6"
              >
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 flex items-center justify-center">
                  <WifiOff size={26} className="text-red-400" />
                </div>
                <div className="text-center max-w-sm">
                  <p className="text-sm font-bold text-white mb-2">Connexion bloquée</p>
                  <p className="text-[12px] text-gray-500 leading-relaxed">
                    gps-go.com a bloqué l&apos;affichage dans cette fenêtre.
                    Ouvre directement dans un nouvel onglet.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={reload}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1E2D45] text-[12px] font-semibold text-gray-300 hover:text-white hover:border-gray-500 transition">
                    <RefreshCw size={12} /> Réessayer
                  </button>
                  <a href={GPS_URL} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[12px] font-semibold text-white transition shadow-lg shadow-indigo-500/20">
                    <ExternalLink size={12} /> Ouvrir gps-go.com
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <iframe
            key={key}
            ref={iframeRef}
            src={GPS_URL}
            className={`w-full h-full border-0 transition-opacity duration-700 ${loading_ || error ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            title="GPS Live — Boyah Group"
            allow="geolocation; fullscreen"
            onLoad={onLoad}
            onError={() => { setLoading(false); setError(true) }}
          />
        </div>

        {/* ── Sliding vehicle panel ─────────────────────────────────────── */}
        <AnimatePresence>
          {showPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex-shrink-0 overflow-hidden border-l border-[#1E2D45] bg-[#0D1424]"
            >
              <div className="w-60 h-full flex flex-col">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2D45]">
                  <div>
                    <p className="text-[11px] font-bold text-white">Flotte active</p>
                    <p className="text-[10px] text-gray-500">{actifs} véhicule{actifs > 1 ? "s" : ""}</p>
                  </div>
                  <button onClick={() => setShowPanel(false)}
                    className="p-1 rounded-lg text-gray-500 hover:text-gray-300 transition">
                    <X size={13} />
                  </button>
                </div>

                {/* Vehicle list */}
                <div className="flex-1 overflow-y-auto py-2">
                  {vehicules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <Car size={20} className="text-gray-700" />
                      <p className="text-[11px] text-gray-600">Chargement…</p>
                    </div>
                  ) : (
                    vehicules.map((v, i) => (
                      <motion.div
                        key={v.id_vehicule}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.025 }}
                      >
                        <Link href={`/vehicules/${v.id_vehicule}`}
                          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.03] transition group">
                          <LiveDot active size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-gray-200 font-mono truncate">{v.immatriculation}</p>
                            <p className="text-[10px] text-gray-600 truncate">{v.type_vehicule || "VTC"}</p>
                          </div>
                          <ChevronRight size={11} className="text-gray-700 group-hover:text-indigo-500 transition flex-shrink-0" />
                        </Link>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Panel footer */}
                <div className="border-t border-[#1E2D45] px-4 py-3">
                  <a href={GPS_URL} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 ring-1 ring-indigo-500/20 hover:bg-indigo-500/20 transition">
                    <ExternalLink size={11} /> Ouvrir gps-go.com
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM STATUS BAR ───────────────────────────────────────────────── */}
      {!loading_ && !error && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center justify-between px-4 py-1.5 bg-[#080C14] border-t border-[#1A2235] flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <Wifi size={9} className="text-emerald-500" /> Connecté
            </span>
            <span className="text-[10px] text-gray-700">·</span>
            <span className="text-[10px] text-gray-600">
              gps-go.com · Abidjan, Côte d&apos;Ivoire
            </span>
          </div>
          <span className="text-[10px] text-gray-700 flex items-center gap-1">
            <Clock size={9} /> Actif depuis <ElapsedTimer since={loadedAt} />
          </span>
        </motion.div>
      )}

      {/* ESC hint in fullscreen */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ delay: 0.5 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-[10px] text-gray-400 pointer-events-none"
          >
            <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono">ESC</kbd>
            pour quitter le plein écran
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

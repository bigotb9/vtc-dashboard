"use client"

/**
 * /cockpit — Cockpit Boyah Étape 2/3
 *
 * Tableau de bord d'action pour Emmanuel : 4 zones empilées.
 *   - Zone 1 : KPIs vitaux (cashflow, activité, retards, dette)
 *   - Zone 2 : Alertes à traiter aujourd'hui
 *   - Zone 3 : Conversations (auto-suggestions + ma liste todos)
 *   - Zone 4 : Mini-radar flotte
 *
 * Refresh auto toutes les 60s, refresh manuel, gestion erreur par zone,
 * loaders et états vides.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Gauge, RefreshCw } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { useProfile } from "@/hooks/useProfile"
import CockpitKpis from "@/components/cockpit/CockpitKpis"
import CockpitAlertes from "@/components/cockpit/CockpitAlertes"
import CockpitConversations from "@/components/cockpit/CockpitConversations"
import CockpitFlotte from "@/components/cockpit/CockpitFlotte"
import CockpitDeficitaires from "@/components/cockpit/CockpitDeficitaires"
import type {
  Kpis, Alerte, Conversation, Todo, FlottePayload, CockpitFinances,
} from "@/components/cockpit/types"

const REFRESH_INTERVAL_MS = 60_000

type ZoneState<T> = {
  data:    T | null
  loading: boolean
  error:   string | null
}

type ZoneListState<T> = {
  data:    T[]
  loading: boolean
  error:   string | null
}

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await authFetch(url)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `HTTP ${res.status}` }
    }
    return { ok: true, data: json.data as T }
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Erreur réseau" }
  }
}

export default function CockpitPage() {
  // Permission finance (lecture seule données sensibles : marge, arriéré,
  // déficitaires). Le directeur a tout via useProfile().can.
  const { can } = useProfile()
  const canFinances = can("view_finances_cockpit")

  const [kpis,          setKpis]          = useState<ZoneState<Kpis>>({ data: null, loading: true, error: null })
  const [alertes,       setAlertes]       = useState<ZoneListState<Alerte>>({ data: [], loading: true, error: null })
  const [conversations, setConversations] = useState<ZoneListState<Conversation>>({ data: [], loading: true, error: null })
  const [todos,         setTodos]         = useState<ZoneListState<Todo>>({ data: [], loading: true, error: null })
  const [flotte,        setFlotte]        = useState<ZoneState<FlottePayload>>({ data: null, loading: true, error: null })
  const [finances,      setFinances]      = useState<ZoneState<CockpitFinances>>({ data: null, loading: true, error: null })

  const [refreshing, setRefreshing] = useState(false)
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null)
  const mountedRef = useRef(false)

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    // Lance les fetchs en parallèle. La route /finances n'est appelée QUE si
    // l'utilisateur a la permission view_finances_cockpit (données sensibles).
    const [rKpis, rAlertes, rConv, rTodos, rFlotte, rFin] = await Promise.all([
      fetchJson<Kpis>("/api/cockpit/kpis"),
      fetchJson<Alerte[]>("/api/cockpit/alertes"),
      fetchJson<Conversation[]>("/api/cockpit/conversations"),
      fetchJson<Todo[]>("/api/cockpit/todos"),
      fetchJson<FlottePayload>("/api/cockpit/flotte"),
      canFinances
        ? fetchJson<CockpitFinances>("/api/cockpit/finances")
        : Promise.resolve(null),
    ])

    if (!mountedRef.current) return

    setKpis(rKpis.ok
      ? { data: rKpis.data, loading: false, error: null }
      : { data: null,       loading: false, error: rKpis.error })
    setAlertes(rAlertes.ok
      ? { data: rAlertes.data, loading: false, error: null }
      : { data: [],            loading: false, error: rAlertes.error })
    setConversations(rConv.ok
      ? { data: rConv.data, loading: false, error: null }
      : { data: [],         loading: false, error: rConv.error })
    setTodos(rTodos.ok
      ? { data: rTodos.data, loading: false, error: null }
      : { data: [],          loading: false, error: rTodos.error })
    setFlotte(rFlotte.ok
      ? { data: rFlotte.data, loading: false, error: null }
      : { data: null,         loading: false, error: rFlotte.error })

    if (rFin == null) {
      // Pas la permission : on neutralise la zone (rien à afficher, pas d'erreur)
      setFinances({ data: null, loading: false, error: null })
    } else {
      setFinances(rFin.ok
        ? { data: rFin.data, loading: false, error: null }
        : { data: null,      loading: false, error: rFin.error })
    }

    setLastFetchAt(new Date())
    if (showSpinner) setRefreshing(false)
  }, [canFinances])

  const refreshTodos = useCallback(async () => {
    const r = await fetchJson<Todo[]>("/api/cockpit/todos")
    if (!mountedRef.current) return
    setTodos(r.ok
      ? { data: r.data, loading: false, error: null }
      : { data: todos.data, loading: false, error: r.error })
  }, [todos.data])

  useEffect(() => {
    mountedRef.current = true
    fetchAll(false)
    const id = setInterval(() => fetchAll(false), REFRESH_INTERVAL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(id)
    }
  }, [fetchAll])

  const lastFetchLabel = lastFetchAt
    ? `Mis à jour à ${lastFetchAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : ""

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
            <Gauge size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Cockpit Boyah</h1>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Tableau de bord d&apos;action {lastFetchLabel && `· ${lastFetchLabel}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition disabled:opacity-50"
          title="Actualiser maintenant"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          <span className="text-xs font-bold">{refreshing ? "Actualisation…" : "Actualiser"}</span>
        </button>
      </header>

      {/* ZONE 1 — KPIs (+ cards finance si permission) */}
      <CockpitKpis
        data={kpis.data}
        loading={kpis.loading}
        error={kpis.error}
        canFinances={canFinances}
        finances={finances.data}
        financesLoading={finances.loading}
        financesError={finances.error}
      />

      {/* ZONE 1-bis — Véhicules clients déficitaires (sensible, si permission) */}
      {canFinances && (
        <div className="rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-5">
          <CockpitDeficitaires
            deficitaires={finances.data?.deficitaires ?? []}
            loading={finances.loading}
            error={finances.error}
          />
        </div>
      )}

      {/* ZONE 2 — Alertes */}
      <div className="rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-5">
        <CockpitAlertes
          alertes={alertes.data}
          conversations={conversations.data}
          loading={alertes.loading}
          error={alertes.error}
        />
      </div>

      {/* ZONE 3 — Conversations */}
      <div className="rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-5">
        <CockpitConversations
          conversations={conversations.data}
          loadingConv={conversations.loading}
          errorConv={conversations.error}
          todos={todos.data}
          loadingTodos={todos.loading}
          errorTodos={todos.error}
          onTodosChanged={refreshTodos}
        />
      </div>

      {/* ZONE 4 — Mini-radar flotte */}
      <div className="rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-5">
        <CockpitFlotte
          data={flotte.data}
          loading={flotte.loading}
          error={flotte.error}
        />
      </div>
    </div>
  )
}

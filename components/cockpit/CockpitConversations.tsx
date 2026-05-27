"use client"

/**
 * components/cockpit/CockpitConversations.tsx
 *
 * Zone 3 — Cockpit Boyah : 2 onglets
 *   - "Auto-suggestions"  : /api/cockpit/conversations
 *   - "Ma liste"          : /api/cockpit/todos (CRUD)
 *
 * Conversations :
 *   - card par message proposé
 *   - actions : WhatsApp / Copier / Marquer fait (localStorage)
 *
 * Todos :
 *   - checkbox + texte, suppression au hover
 *   - input "Ajouter…" en bas
 */

import { useEffect, useMemo, useState } from "react"
import { MessageCircle, Copy, Check, Trash2, Plus } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { Conversation, Todo } from "./types"

const LS_KEY_CONVERSATIONS = "cockpit_conversations_traitees"

/** wa.me builder identique à ContactsModal. */
function toWaUrl(numero: string, message: string): string {
  const clean = numero.replace(/[^0-9]/g, "")
  const final = clean.length === 10 ? `225${clean}` : clean
  return `https://wa.me/${final}?text=${encodeURIComponent(message)}`
}

type Props = {
  conversations:  Conversation[]
  loadingConv:    boolean
  errorConv:      string | null

  todos:          Todo[]
  loadingTodos:   boolean
  errorTodos:     string | null
  onTodosChanged: () => void   // pour rafraîchir après mutation
}

export default function CockpitConversations(props: Props) {
  const [tab, setTab] = useState<"auto" | "mine">("auto")
  const [traites, setTraites] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_CONVERSATIONS)
      if (raw) setTraites(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
  }, [])

  const markTraite = (id: string) => {
    setTraites(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(LS_KEY_CONVERSATIONS, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
      return next
    })
  }

  const activeConvs = useMemo(
    () => props.conversations.filter(c => !traites.has(c.id)),
    [props.conversations, traites],
  )
  const activeTodos = useMemo(
    () => props.todos.filter(t => !t.done),
    [props.todos],
  )

  return (
    <section>
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
        Conversations à préparer
      </h2>

      <div className="flex border-b border-gray-200 dark:border-[#1E2D45] mb-4">
        <TabButton active={tab === "auto"} onClick={() => setTab("auto")}>
          Auto-suggestions ({activeConvs.length})
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          Ma liste ({activeTodos.length})
        </TabButton>
      </div>

      {tab === "auto"
        ? <AutoSuggestionsTab
            conversations={props.conversations}
            traites={traites}
            onTraite={markTraite}
            loading={props.loadingConv}
            error={props.errorConv}
          />
        : <MaListeTab
            todos={props.todos}
            loading={props.loadingTodos}
            error={props.errorTodos}
            onChanged={props.onTodosChanged}
          />
      }
    </section>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-bold transition border-b-2 -mb-px ${
        active
          ? "text-indigo-600 dark:text-indigo-400 border-indigo-500"
          : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Onglet Auto-suggestions
// ════════════════════════════════════════════════════════════════════════
function AutoSuggestionsTab({ conversations, traites, onTraite, loading, error }: {
  conversations: Conversation[]
  traites:       Set<string>
  onTraite:      (id: string) => void
  loading:       boolean
  error:         string | null
}) {
  const sorted = [...conversations].sort((a, b) => {
    const aFait = traites.has(a.id) ? 1 : 0
    const bFait = traites.has(b.id) ? 1 : 0
    return aFait - bFait
  })

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
        Erreur conversations : {error}
      </div>
    )
  }
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    )
  }
  if (sorted.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 italic p-4 text-center">
        Aucune conversation à préparer.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {sorted.map(c => (
        <ConversationCard
          key={c.id}
          conversation={c}
          fait={traites.has(c.id)}
          onFait={() => onTraite(c.id)}
        />
      ))}
    </ul>
  )
}

function ConversationCard({ conversation, fait, onFait }: {
  conversation: Conversation
  fait:         boolean
  onFait:       () => void
}) {
  const numero = conversation.contacts[0]?.numero ?? ""
  const isFelicitation = conversation.type === "felicitation"

  const badgeLabel =
    conversation.type === "retard_chauffeur" ? "Relance" :
    conversation.type === "retard_client"    ? "Client"  :
                                                "Bravo"
  const badgeClass =
    conversation.type === "retard_chauffeur" ? "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400" :
    conversation.type === "retard_client"    ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                                                "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(conversation.message)
      toast.success("Message copié")
    } catch {
      toast.error("Impossible de copier")
    }
  }

  return (
    <li
      className={`rounded-xl border p-3 transition ${
        fait
          ? "opacity-45 border-gray-100 dark:border-[#1E2D45] bg-gray-50/40 dark:bg-white/[0.01]"
          : "border-gray-100 dark:border-[#1E2D45] bg-gray-50/40 dark:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {conversation.titre}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {conversation.meta}
          </p>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeClass} shrink-0`}>
          {badgeLabel}
        </span>
      </div>

      <div className="my-2 p-2.5 rounded-lg bg-white dark:bg-white/[0.02] border-l-2 border-indigo-300 dark:border-indigo-500/40 text-[12.5px] text-gray-700 dark:text-gray-300 italic leading-relaxed font-serif">
        {conversation.message}
      </div>

      <div className="flex items-center gap-2 mt-2">
        {numero ? (
          <a
            href={toWaUrl(numero, conversation.message)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition shrink-0 ${
              isFelicitation ? "bg-emerald-500 hover:bg-emerald-600" : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            <MessageCircle size={12} />
            WhatsApp
          </a>
        ) : (
          <span className="text-[11px] text-gray-400 italic">Numéro indisponible</span>
        )}
        <button
          onClick={copyMessage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-bold transition"
        >
          <Copy size={12} />
          Copier
        </button>
        <button
          onClick={onFait}
          disabled={fait}
          className={`ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
            fait
              ? "bg-gray-100 dark:bg-white/5 text-gray-400 cursor-default"
              : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
          }`}
        >
          <Check size={12} />
          {fait ? "Fait" : "Marquer fait"}
        </button>
      </div>
    </li>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Onglet Ma liste
// ════════════════════════════════════════════════════════════════════════
function MaListeTab({ todos, loading, error, onChanged }: {
  todos:     Todo[]
  loading:   boolean
  error:     string | null
  onChanged: () => void
}) {
  const [newText, setNewText] = useState("")
  const [busy, setBusy] = useState(false)

  const addTodo = async () => {
    const texte = newText.trim()
    if (!texte) return
    setBusy(true)
    try {
      const res = await authFetch("/api/cockpit/todos", {
        method: "POST",
        body:   JSON.stringify({ texte }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Erreur création")
      setNewText("")
      onChanged()
      toast.success("Tâche ajoutée")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggleDone = async (t: Todo) => {
    try {
      const res = await authFetch(`/api/cockpit/todos/${t.id}`, {
        method: "PATCH",
        body:   JSON.stringify({ done: !t.done }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur mise à jour")
      }
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const deleteTodo = async (id: string) => {
    try {
      const res = await authFetch(`/api/cockpit/todos/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur suppression")
      }
      onChanged()
      toast.success("Tâche supprimée")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
        Erreur todos : {error}
      </div>
    )
  }

  return (
    <div>
      <ul className="space-y-1">
        {loading && todos.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
          ))
        ) : todos.length === 0 ? (
          <li className="text-sm text-gray-400 dark:text-gray-500 italic p-4 text-center">
            Aucune tâche pour l&apos;instant.
          </li>
        ) : (
          todos.map(t => (
            <li
              key={t.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${
                t.done ? "opacity-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleDone(t)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
              />
              <span
                className={`flex-1 text-sm ${
                  t.done
                    ? "line-through text-gray-400 dark:text-gray-500"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {t.texte}
              </span>
              <button
                onClick={() => deleteTodo(t.id)}
                title="Supprimer"
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-[#1E2D45]">
        <Plus size={14} className="text-gray-400" />
        <input
          type="text"
          value={newText}
          disabled={busy}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addTodo() }}
          placeholder="Ajouter une tâche…"
          className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          maxLength={500}
        />
      </div>
    </div>
  )
}

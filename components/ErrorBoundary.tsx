"use client"

import { Component, ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

type Props = { children: ReactNode; label?: string }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-center">
        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
          <AlertTriangle size={18} className="text-red-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            {this.props.label ?? "Ce composant a rencontré une erreur"}
          </p>
          <p className="text-xs text-red-500/70 dark:text-red-500/50 mt-0.5">
            {this.state.error.message}
          </p>
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/10 transition"
        >
          <RefreshCw size={11} /> Réessayer
        </button>
      </div>
    )
  }
}

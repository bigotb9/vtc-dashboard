export type ToastType = "success" | "error" | "info" | "warning"

export type Toast = {
  id:       string
  message:  string
  type:     ToastType
  duration: number
}

type Listener = (toasts: Toast[]) => void

let toasts: Toast[]    = []
let listeners: Listener[] = []

function notify() {
  listeners.forEach(l => l([...toasts]))
}

export const toastStore = {
  subscribe(l: Listener) {
    listeners.push(l)
    return () => { listeners = listeners.filter(x => x !== l) }
  },
  add(message: string, type: ToastType = "info", duration = 3500) {
    const id = Math.random().toString(36).slice(2)
    toasts = [...toasts, { id, message, type, duration }]
    notify()
    setTimeout(() => toastStore.remove(id), duration)
  },
  remove(id: string) {
    toasts = toasts.filter(t => t.id !== id)
    notify()
  },
}

export const toast = {
  success: (msg: string, duration?: number) => toastStore.add(msg, "success", duration),
  error:   (msg: string, duration?: number) => toastStore.add(msg, "error",   duration ?? 5000),
  info:    (msg: string, duration?: number) => toastStore.add(msg, "info",    duration),
  warning: (msg: string, duration?: number) => toastStore.add(msg, "warning", duration),
}

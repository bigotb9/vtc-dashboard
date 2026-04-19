"use client"

import { useEffect, useRef } from "react"

// ── Isometric config ───────────────────────────────────────────────────────────
const TW   = 54   // tile width
const TH   = 27   // tile height (TW/2 = perfect isometric ratio)
const COLS = 12
const ROWS = 12

function iso(col: number, row: number, ox: number, oy: number) {
  return {
    x: ox + (col - row) * TW / 2,
    y: oy + (col + row) * TH / 2,
  }
}

function diamond(ctx: CanvasRenderingContext2D, col: number, row: number, ox: number, oy: number) {
  const c = iso(col, row, ox, oy)
  ctx.beginPath()
  ctx.moveTo(c.x,          c.y)
  ctx.lineTo(c.x + TW / 2, c.y + TH / 2)
  ctx.lineTo(c.x,          c.y + TH)
  ctx.lineTo(c.x - TW / 2, c.y + TH / 2)
  ctx.closePath()
}

// ── Vehicle paths (grid waypoints) ────────────────────────────────────────────
const PATHS: [number, number][][] = [
  [[1,1],[3,1],[5,1],[7,1],[9,1],[9,3],[7,3],[5,3],[3,3],[1,3],[1,5],[3,5],[5,5],[7,5],[9,5],[9,7],[7,7],[5,7],[3,7],[1,7]],
  [[0,3],[2,3],[4,3],[6,3],[8,3],[10,3],[10,5],[8,5],[6,5],[4,5],[2,5],[0,5],[0,7],[2,7],[4,7],[6,7],[8,7],[10,7],[10,9],[8,9]],
  [[2,0],[4,0],[6,0],[8,0],[10,0],[10,2],[8,2],[6,2],[4,2],[2,2],[0,2],[0,4],[2,4],[4,4],[6,4],[8,4],[10,4],[10,6],[8,6],[6,6]],
  [[5,1],[5,3],[5,5],[5,7],[5,9],[3,9],[1,9],[1,7],[1,5],[1,3],[1,1],[3,1],[5,1]],
  [[0,6],[2,6],[4,6],[6,6],[8,6],[10,6],[10,8],[8,8],[6,8],[4,8],[2,8],[0,8],[0,10],[2,10],[4,10],[6,10],[8,10],[10,10]],
  [[11,1],[9,1],[7,1],[5,1],[3,1],[1,1],[1,3],[3,3],[5,3],[7,3],[9,3],[11,3],[11,5],[9,5],[7,5],[5,5],[3,5],[1,5],[1,7],[3,7]],
  [[2,2],[4,2],[6,2],[8,2],[10,2],[10,4],[8,4],[6,4],[4,4],[2,4],[0,4],[0,6],[2,6],[4,6],[6,6],[8,6],[10,6]],
  [[0,0],[2,0],[4,0],[6,0],[8,0],[10,0],[10,2],[8,2],[6,2],[4,2],[2,2],[0,2],[0,4],[0,6],[0,8],[0,10],[2,10],[4,10]],
]

const COLORS = [
  { dot: "#818cf8", trail: "99,102,241",   glow: "#4f46e5" },
  { dot: "#a78bfa", trail: "139,92,246",   glow: "#7c3aed" },
  { dot: "#38bdf8", trail: "56,189,248",   glow: "#0284c7" },
  { dot: "#34d399", trail: "52,211,153",   glow: "#059669" },
  { dot: "#f472b6", trail: "244,114,182",  glow: "#db2777" },
  { dot: "#fbbf24", trail: "251,191,36",   glow: "#d97706" },
  { dot: "#6ee7b7", trail: "110,231,183",  glow: "#10b981" },
  { dot: "#c084fc", trail: "192,132,252",  glow: "#9333ea" },
]

type Vec2 = { x: number; y: number }

type Vehicle = {
  pathIdx:     number
  wpIdx:       number
  t:           number
  speed:       number
  color:       typeof COLORS[0]
  trail:       Vec2[]
  pulseR:      number
}

type LitTile = { col: number; row: number; alpha: number; dir: number }

function makeVehicles(): Vehicle[] {
  return PATHS.map((path, i) => ({
    pathIdx: i,
    wpIdx:   Math.floor(Math.random() * (path.length - 1)),
    t:       Math.random(),
    speed:   0.003 + Math.random() * 0.004,
    color:   COLORS[i % COLORS.length],
    trail:   [],
    pulseR:  0,
  }))
}

function makeLitTiles(n: number): LitTile[] {
  return Array.from({ length: n }, () => ({
    col:   Math.floor(Math.random() * COLS),
    row:   Math.floor(Math.random() * ROWS),
    alpha: Math.random() * 0.3,
    dir:   1,
  }))
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function IsometricScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = 0, H = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      W = rect.width
      H = rect.height
      canvas.width  = Math.round(W * devicePixelRatio)
      canvas.height = Math.round(H * devicePixelRatio)
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const vehicles = makeVehicles()
    const litTiles = makeLitTiles(14)

    const frame = () => {
      if (!W || !H) { rafRef.current = requestAnimationFrame(frame); return }
      ctx.clearRect(0, 0, W, H)

      // Isometric grid origin — centered
      const gridH = (COLS + ROWS) * TH / 2
      const ox = W / 2
      const oy = (H - gridH) / 2 + 6

      // ── Grid ──────────────────────────────────────────────────────────
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          diamond(ctx, col, row, ox, oy)
          ctx.strokeStyle = "rgba(99,102,241,0.11)"
          ctx.lineWidth   = 0.6
          ctx.stroke()
        }
      }

      // ── Pulsing tiles ─────────────────────────────────────────────────
      litTiles.forEach(t => {
        t.alpha += t.dir * 0.005
        if (t.alpha > 0.45) t.dir = -1
        if (t.alpha < 0) {
          t.alpha = 0
          t.dir   = 1
          t.col   = Math.floor(Math.random() * COLS)
          t.row   = Math.floor(Math.random() * ROWS)
        }
        diamond(ctx, t.col, t.row, ox, oy)
        ctx.fillStyle   = `rgba(99,102,241,${t.alpha * 0.18})`
        ctx.fill()
        ctx.strokeStyle = `rgba(129,140,248,${t.alpha * 0.6})`
        ctx.lineWidth   = 0.7
        ctx.stroke()
      })

      // ── Vehicles ──────────────────────────────────────────────────────
      const positions: Vec2[] = []

      vehicles.forEach(v => {
        const path = PATHS[v.pathIdx]
        v.t += v.speed
        if (v.t >= 1) {
          v.t   -= 1
          v.wpIdx = (v.wpIdx + 1) % path.length
        }

        const [c1, r1] = path[v.wpIdx]
        const [c2, r2] = path[(v.wpIdx + 1) % path.length]
        const p1 = iso(c1, r1, ox, oy)
        const p2 = iso(c2, r2, ox, oy)

        const x = p1.x + (p2.x - p1.x) * v.t
        const y = p1.y + TH / 2 + (p2.y - p1.y) * v.t

        v.trail.push({ x, y })
        if (v.trail.length > 28) v.trail.shift()

        positions.push({ x, y })

        // Trail
        for (let i = 1; i < v.trail.length; i++) {
          const a = (i / v.trail.length) * 0.55
          ctx.beginPath()
          ctx.moveTo(v.trail[i - 1].x, v.trail[i - 1].y)
          ctx.lineTo(v.trail[i].x,     v.trail[i].y)
          ctx.strokeStyle = `rgba(${v.color.trail},${a})`
          ctx.lineWidth   = 1.8
          ctx.stroke()
        }

        // Pulse ring
        v.pulseR = (v.pulseR + 0.15) % (Math.PI * 2)
        const pulseAlpha = (Math.sin(v.pulseR) * 0.5 + 0.5) * 0.35
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${v.color.trail},${pulseAlpha})`
        ctx.lineWidth   = 1.2
        ctx.stroke()

        // Dot with glow
        ctx.save()
        ctx.shadowBlur  = 14
        ctx.shadowColor = v.color.glow
        ctx.beginPath()
        ctx.arc(x, y, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = v.color.dot
        ctx.fill()
        // Inner bright core
        ctx.shadowBlur  = 6
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = "#ffffff"
        ctx.fill()
        ctx.restore()
      })

      // ── Connection lines ──────────────────────────────────────────────
      const MAX_DIST = 140
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i], b = positions[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.3
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(139,92,246,${alpha})`
            ctx.lineWidth   = 0.9
            ctx.stroke()
          }
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}

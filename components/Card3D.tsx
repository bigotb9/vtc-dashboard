"use client"

import { useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

type Card3DProps = {
  children:   React.ReactNode
  className?: string
  glare?:     boolean
  depth?:     number
}

export default function Card3D({ children, className = "", glare = true, depth = 12 }: Card3DProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)

  const rotateX = useSpring(useTransform(y, [0, 1], [depth, -depth]), { stiffness: 250, damping: 20 })
  const rotateY = useSpring(useTransform(x, [0, 1], [-depth, depth]), { stiffness: 250, damping: 20 })

  // Ombre dynamique — extraits au top level (plus de hooks dans JSX)
  const shadowX = useTransform(x, [0, 1], [8, -8])
  const shadowY = useTransform(y, [0, 1], [8, -8])
  const boxShadow = useTransform(
    [shadowX, shadowY],
    ([sx, sy]: number[]) =>
      hovered
        ? `${sx}px ${sy}px 30px -5px rgba(99,102,241,0.18), 0 8px 24px -4px rgba(0,0,0,0.12)`
        : "0 2px 12px -2px rgba(0,0,0,0.08)"
  )

  // Reflet — extrait au top level
  const glareX = useTransform(x, [0, 1], ["-50%", "150%"])
  const glareY = useTransform(y, [0, 1], ["-50%", "150%"])
  const glareBackground = useTransform(
    [glareX, glareY],
    ([gx, gy]: string[]) =>
      `radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.9), transparent 60%)`
  )

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    x.set((e.clientX - rect.left) / rect.width)
    y.set((e.clientY - rect.top) / rect.height)
  }

  function handleLeave() {
    setHovered(false)
    x.set(0.5)
    y.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", boxShadow }}
      className={`relative rounded-2xl transition-colors ${className}`}
    >
      <div style={{ transform: "translateZ(20px)", transformStyle: "preserve-3d" }}>
        {children}
      </div>

      {glare && (
        <motion.div
          style={{
            position:     "absolute",
            inset:        0,
            borderRadius: "inherit",
            pointerEvents: "none",
            opacity:      hovered ? 0.12 : 0,
            background:   glareBackground,
            transition:   "opacity 0.3s ease",
          }}
        />
      )}
    </motion.div>
  )
}

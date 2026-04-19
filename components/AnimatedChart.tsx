"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"

type Props = {
  children: React.ReactNode
  className?: string
  delay?: number
}

/**
 * Wrap any Recharts component in <AnimatedChart> to get:
 * - Fade-in + scale-up on scroll into view
 * - Clip-path reveal animation (left-to-right wipe)
 */
export default function AnimatedChart({ children, className = "", delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97, clipPath: "inset(0 100% 0 0)" }}
      animate={inView
        ? { opacity: 1, scale: 1, clipPath: "inset(0 0% 0 0)" }
        : {}
      }
      transition={{
        duration: 0.7,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
        clipPath: { duration: 0.9, delay: delay + 0.1, ease: "easeOut" },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

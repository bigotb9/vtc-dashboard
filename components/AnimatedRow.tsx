"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"

type Props = {
  children: React.ReactNode
  index?:   number
  className?: string
}

/**
 * Wrap a <tr> content in <AnimatedRow> for:
 * - Staggered fade-in from bottom
 * - Hover: slight elevation + left accent border
 */
export default function AnimatedRow({ children, index = 0, className = "" }: Props) {
  const ref = useRef<HTMLTableRowElement>(null)
  const inView = useInView(ref, { once: true, margin: "-20px" })

  return (
    <motion.tr
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4), ease: "easeOut" }}
      className={`group transition-all duration-150
        hover:bg-indigo-50/50 dark:hover:bg-indigo-500/[0.04]
        hover:shadow-[inset_3px_0_0_0_#6366f1]
        ${className}`}
    >
      {children}
    </motion.tr>
  )
}

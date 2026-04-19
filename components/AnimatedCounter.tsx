"use client"

import { useEffect, useRef } from "react"
import { useInView, useMotionValue, useSpring, motion } from "framer-motion"

type Props = {
  value:       number
  suffix?:     string   // ex: " FCFA", "%"
  prefix?:     string   // ex: "$"
  duration?:   number   // secondes (défaut: 1.2)
  className?:  string
  locale?:     string   // défaut: "fr-FR"
}

export default function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  duration = 1.2,
  className = "",
  locale = "fr-FR",
}: Props) {
  const ref       = useRef<HTMLSpanElement>(null)
  const inView    = useInView(ref, { once: true, margin: "-40px" })
  const motionVal = useMotionValue(0)
  const spring    = useSpring(motionVal, {
    stiffness: 60,
    damping:   20,
    duration:  duration * 1000,
  })

  useEffect(() => {
    if (inView) motionVal.set(value)
  }, [inView, value, motionVal])

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent =
          prefix + Math.round(v).toLocaleString(locale) + suffix
      }
    })
    return unsubscribe
  }, [spring, prefix, suffix, locale])

  return (
    <motion.span
      ref={ref}
      className={`font-numeric tabular-nums ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {prefix}0{suffix}
    </motion.span>
  )
}

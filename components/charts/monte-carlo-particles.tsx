"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  targetY: number
  vx: number
  vy: number
  percentile: "p10" | "p25" | "p50" | "p75" | "p90"
  life: number
  maxLife: number
  index: number
}

interface MonteCarloParticlesProps {
  isRunning: boolean
  simulationRunCount: number
  width: number
  height: number
  currentAge: number
  maxAge: number
}

const PARTICLE_COUNT_PER_RUN = 8
const SPRING_TENSION = 0.08
const SPRING_DAMPING = 0.15
const PARTICLE_SPEED = 1.2

const PERCENTILE_COLORS = {
  p10: "rgba(81, 132, 236, 0.8)",    // chart-blue, more opaque
  p25: "rgba(81, 132, 236, 0.6)",
  p50: "rgba(243, 180, 22, 0.9)",    // analyst-gold, vibrant
  p75: "rgba(26, 184, 74, 0.6)",     // chart-teal
  p90: "rgba(26, 184, 74, 0.8)",
}

const PERCENTILE_DISTRIBUTION = {
  p10: 0.08,
  p25: 0.24,
  p50: 0.36,
  p75: 0.24,
  p90: 0.08,
}

const PERCENTILE_Y_POSITION = {
  p10: 0.88,
  p25: 0.68,
  p50: 0.50,
  p75: 0.28,
  p90: 0.08,
}

export function MonteCarloParticles({
  isRunning,
  simulationRunCount,
  width,
  height,
  currentAge,
  maxAge,
}: MonteCarloParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationIdRef = useRef<number | undefined>(undefined)
  const lastRunCountRef = useRef<number>(0)
  const prefersReducedMotion = useRef<boolean>(false)

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion.current) return

    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: false })
    if (!ctx) return

    let frameCount = 0
    const ageRange = maxAge - currentAge

    const generateParticles = () => {
      const newParticles: Particle[] = []
      const newRunsCount = Math.min(simulationRunCount - lastRunCountRef.current, 3000)

      for (let i = 0; i < newRunsCount; i++) {
        const percentiles = Object.keys(PERCENTILE_DISTRIBUTION) as Array<keyof typeof PERCENTILE_DISTRIBUTION>
        let rand = Math.random()
        let percentile = percentiles[0]

        for (const p of percentiles) {
          rand -= PERCENTILE_DISTRIBUTION[p]
          if (rand <= 0) {
            percentile = p
            break
          }
        }

        const yPositionRatio = PERCENTILE_Y_POSITION[percentile]
        const targetY = height * yPositionRatio
        const startY = height * 0.5 + (Math.random() - 0.5) * height * 0.3

        newParticles.push({
          x: width * 0.02 + Math.random() * width * 0.03,
          y: startY,
          targetY,
          vx: PARTICLE_SPEED + Math.random() * 0.5,
          vy: 0,
          percentile,
          life: 0,
          maxLife: 140 + Math.random() * 80,
          index: lastRunCountRef.current + i,
        })
      }

      lastRunCountRef.current = simulationRunCount
      particlesRef.current = [...particlesRef.current, ...newParticles]
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      if (isRunning) {
        generateParticles()
      }

      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        // Spring towards target Y
        const dy = p.targetY - p.y
        const force = dy * SPRING_TENSION
        p.vy += force
        p.vy *= 1 - SPRING_DAMPING

        p.x += p.vx
        p.y += p.vy

        // Life and fade
        p.life++
        const lifeProgress = p.life / p.maxLife
        let alpha = Math.max(0, 1 - lifeProgress)

        if (lifeProgress > 0.7) {
          alpha *= (1 - (lifeProgress - 0.7) / 0.3)
        }

        // Draw particle with glow
        const color = PERCENTILE_COLORS[p.percentile]
        const rgbaColor = color.replace(")", `, ${alpha})`)
        const glowAlpha = Math.max(0, alpha * 0.3)
        const glowColor = color.replace(")", `, ${glowAlpha})`)

        // Glow halo
        ctx.fillStyle = glowColor
        ctx.beginPath()
        ctx.arc(p.x, p.y, 5.5 + Math.random() * 0.5, 0, Math.PI * 2)
        ctx.fill()

        // Core particle
        ctx.fillStyle = rgbaColor
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.2 + Math.random() * 0.5, 0, Math.PI * 2)
        ctx.fill()

        // Remove dead particles
        if (p.life > p.maxLife) {
          particles.splice(i, 1)
        }
      }

      if (isRunning || particles.length > 0) {
        animationIdRef.current = requestAnimationFrame(animate)
      }
    }

    animationIdRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
    }
  }, [isRunning, simulationRunCount, width, height, currentAge, maxAge])

  if (prefersReducedMotion.current) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0"
      aria-hidden="true"
    />
  )
}

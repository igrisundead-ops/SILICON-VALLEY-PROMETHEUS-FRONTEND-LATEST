"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  const reduced = useReducedMotion()
  const pathname = usePathname()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  const activeItem = hoveredIndex !== null ? hoveredIndex : activeIndex

  React.useEffect(() => {
    const idx = items.findIndex((it) => {
      if (it.url === "/") return pathname === "/"
      return pathname === it.url || pathname.startsWith(`${it.url}/`)
    })
    if (idx >= 0) setActiveIndex(idx)
  }, [items, pathname])

  return (
    <nav
      className={cn(
        "fixed top-6 left-1/2 -translate-x-1/2 z-50",
        className
      )}
    >
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/50 backdrop-blur-xl p-1.5 shadow-lg shadow-purple-500/10">
        {items.map((item, index) => {
          const Icon = item.icon
          const isActive = activeItem === index

          return (
            <a
              key={item.name}
              href={item.url}
              onClick={() => setActiveIndex(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                isActive ? "text-white" : "text-white/60 hover:text-white/80"
              )}
            >
              {isActive && !reduced && (
                <motion.div
                  layoutId="tubelight"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/80 to-violet-600/80"
                  style={{
                    boxShadow: "0 0 20px rgba(147, 51, 234, 0.5), 0 0 40px rgba(147, 51, 234, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)"
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30
                  }}
                />
              )}
              {isActive && reduced && (
                <div
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/60 to-violet-600/60"
                  style={{
                    boxShadow: "0 0 20px rgba(147, 51, 234, 0.25)",
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.name}</span>
              </span>
            </a>
          )
        })}
      </div>
      
      {/* Tubelight glow effect */}
      <div 
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1/2 h-1 rounded-full bg-gradient-to-r from-transparent via-purple-500/50 to-transparent blur-sm"
        aria-hidden="true"
      />
    </nav>
  )
}

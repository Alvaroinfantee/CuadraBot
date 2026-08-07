"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const pollIntervalMs = 3_000
const maxPollAttempts = 30

export function CheckoutConversionPoller() {
  const router = useRouter()
  const attempts = useRef(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      attempts.current += 1
      router.refresh()

      if (attempts.current >= maxPollAttempts) {
        window.clearInterval(interval)
      }
    }, pollIntervalMs)

    return () => window.clearInterval(interval)
  }, [router])

  return null
}

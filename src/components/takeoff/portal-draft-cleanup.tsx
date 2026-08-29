"use client"

import { useEffect } from "react"
import { DRYWALL_ORDER_STORAGE_KEY } from "@/lib/drywall-order-client"

export function PortalDraftCleanup({ projectId }: { projectId: string }) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRYWALL_ORDER_STORAGE_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as { projectId?: unknown }
      if (draft.projectId === projectId) {
        window.localStorage.removeItem(DRYWALL_ORDER_STORAGE_KEY)
      }
    } catch {
      window.localStorage.removeItem(DRYWALL_ORDER_STORAGE_KEY)
    }
  }, [projectId])
  return null
}

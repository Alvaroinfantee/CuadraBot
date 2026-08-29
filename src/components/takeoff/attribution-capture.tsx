"use client"

import { useEffect } from "react"
import { readDrywallOrder, saveDrywallOrder } from "@/lib/drywall-order-client"

export function AttributionCapture() {
  useEffect(() => {
    const order = readDrywallOrder()
    const params = new URLSearchParams(window.location.search)
    const keys = ["gclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
    keys.forEach((key) => {
      const value = params.get(key)
      if (value) order.marketing[key] = value.slice(0, 500)
    })
    order.marketing.landing_path ||= window.location.pathname
    order.marketing.referrer ||= externalReferrerHost()
    order.marketing.device ||= window.innerWidth < 768 ? "mobile" : "desktop"
    order.marketing.country ||= "ES"
    order.sessionId ||= crypto.randomUUID()
    order.firstVisitAt ||= new Date().toISOString()
    saveDrywallOrder(order)
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: "landing_page_view", session_id: order.sessionId, ...order.marketing })
  }, [])

  return null
}

function externalReferrerHost() {
  if (!document.referrer) return ""
  try {
    const referrer = new URL(document.referrer)
    return referrer.origin === window.location.origin ? "" : referrer.hostname.slice(0, 255)
  } catch {
    return ""
  }
}

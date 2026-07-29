import { demoModeEnabled } from "@/lib/config"

export function canShowDemo() {
  return demoModeEnabled || process.env.NODE_ENV !== "production"
}

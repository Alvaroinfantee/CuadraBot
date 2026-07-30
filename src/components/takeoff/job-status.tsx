import { Badge } from "@/components/ui/badge"
import {
  localizedJobStatusLabels,
  type Locale,
} from "@/lib/i18n"
import type { TakeoffJobStatus } from "@/lib/takeoff-types"

const statusMeta: Record<
  TakeoffJobStatus,
  { className: string }
> = {
  draft: { className: "bg-slate-100 text-slate-700" },
  awaiting_upload: {
    className: "bg-slate-100 text-slate-700",
  },
  ready: { className: "bg-blue-50 text-blue-700" },
  queued: { className: "bg-blue-50 text-blue-700" },
  processing: {
    className: "bg-amber-50 text-amber-800",
  },
  needs_review: {
    className: "bg-violet-50 text-violet-700",
  },
  completed: {
    className: "bg-emerald-50 text-emerald-700",
  },
  failed: { className: "bg-red-50 text-red-700" },
  canceled: { className: "bg-slate-100 text-slate-600" },
}

export function JobStatus({
  status,
  locale = "en",
}: {
  status: TakeoffJobStatus
  locale?: Locale
}) {
  const meta = statusMeta[status] ?? statusMeta.failed
  return (
    <Badge variant="secondary" className={meta.className}>
      {localizedJobStatusLabels[locale][status] ??
        localizedJobStatusLabels[locale].failed}
    </Badge>
  )
}

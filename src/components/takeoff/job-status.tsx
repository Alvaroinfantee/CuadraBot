import { Badge } from "@/components/ui/badge"
import type { TakeoffJobStatus } from "@/lib/takeoff-types"

const statusMeta: Record<
  TakeoffJobStatus,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  awaiting_upload: {
    label: "Awaiting upload",
    className: "bg-slate-100 text-slate-700",
  },
  ready: { label: "Quote ready", className: "bg-blue-50 text-blue-700" },
  queued: { label: "Queued", className: "bg-blue-50 text-blue-700" },
  processing: {
    label: "Measuring",
    className: "bg-amber-50 text-amber-800",
  },
  needs_review: {
    label: "Review requested",
    className: "bg-violet-50 text-violet-700",
  },
  completed: {
    label: "Delivered",
    className: "bg-emerald-50 text-emerald-700",
  },
  failed: { label: "Needs attention", className: "bg-red-50 text-red-700" },
  canceled: { label: "Cancelled", className: "bg-slate-100 text-slate-600" },
}

export function JobStatus({ status }: { status: TakeoffJobStatus }) {
  const meta = statusMeta[status] ?? statusMeta.failed
  return (
    <Badge variant="secondary" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

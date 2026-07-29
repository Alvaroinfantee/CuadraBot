import type { ReactNode } from "react"
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function AdminHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {body}
        </p>
      </div>
      {action}
    </div>
  )
}

export function AdminMetric({
  label,
  value,
  note,
  trend,
}: {
  label: string
  value: string
  note: string
  trend?: number
}) {
  const TrendIcon =
    trend === undefined || trend === 0
      ? MinusIcon
      : trend > 0
        ? ArrowUpRightIcon
        : ArrowDownRightIcon
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {trend !== undefined ? (
            <TrendIcon
              className={cn(
                "size-4",
                trend > 0 && "text-emerald-600",
                trend < 0 && "text-red-600"
              )}
            />
          ) : null}
          {note}
        </div>
      </CardContent>
    </Card>
  )
}

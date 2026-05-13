import { Badge } from "@/components/ui/badge"
import { type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { humanizeStatus, statusTone } from "@/lib/format"

const spanishStatus: Record<string, string> = {
  draft: "Borrador",
  awaiting_payment: "Pendiente de pago",
  paid_pending_processing: "Pagado, pendiente de procesamiento",
  processing: "En procesamiento",
  needs_review: "Necesita revisión",
  completed: "Completado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  failed: "Fallido",
}

export function StatusBadge({
  status,
  locale = "en",
}: {
  status: string
  locale?: Locale
}) {
  return (
    <Badge variant="outline" className={cn("rounded-sm", statusTone(status))}>
      {locale === "es" ? spanishStatus[status] ?? humanizeStatus(status) : humanizeStatus(status)}
    </Badge>
  )
}

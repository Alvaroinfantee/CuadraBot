"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import {
  ArrowRightIcon,
  CalculatorIcon,
  CheckIcon,
  ClipboardIcon,
  InfoIcon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  calculateProjectQuote,
  formatQuoteMoney,
  type ProjectQuoteInput,
  type QuoteBreakdownLine,
  type QuoteComplexity,
  type QuoteDeliverySpeed,
  type QuoteMarket,
  type QuoteProjectType,
} from "@/lib/project-quote"
import { localePath, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type QuoteCopy = ReturnType<typeof getQuoteCopy>

const defaultInput: ProjectQuoteInput = {
  market: "usa",
  squareMeters: 150,
  views: 2,
  revisions: 2,
  floors: 1,
  complexity: "standard",
  deliverySpeed: "standard",
  projectType: "house",
  sparsePlans: false,
  advancedSiteContext: false,
}

export function ProjectQuoteCalculator({ locale = "en" }: { locale?: Locale }) {
  const copy = getQuoteCopy(locale)
  const [input, setInput] = useState<ProjectQuoteInput>({
    ...defaultInput,
    market: locale === "es" ? "spain" : "usa",
  })
  const [copied, setCopied] = useState(false)
  const quote = useMemo(() => calculateProjectQuote(input), [input])
  const summary = useMemo(() => createQuoteSummary(copy, quote), [copy, quote])

  useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => setCopied(false), 1800)

    return () => window.clearTimeout(timeout)
  }, [copied])

  function updateInput<Key extends keyof ProjectQuoteInput>(
    key: Key,
    value: ProjectQuoteInput[Key]
  ) {
    setInput((current) => ({ ...current, [key]: value }))
  }

  function updateNumber(
    key: "squareMeters" | "views" | "revisions" | "floors",
    event: ChangeEvent<HTMLInputElement>,
    min: number,
    max: number
  ) {
    const parsed = Number(event.target.value)
    const value = Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : min

    updateInput(key, value)
  }

  async function copySummary() {
    await navigator.clipboard.writeText(summary)
    setCopied(true)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_0.58fr]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{copy.formTitle}</CardTitle>
          <CardDescription>{copy.formDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-5 md:grid-cols-2">
            <SelectField
              label={copy.market}
              value={input.market}
              options={copy.marketOptions}
              onValueChange={(value) => updateInput("market", value as QuoteMarket)}
            />
            <SelectField
              label={copy.projectType}
              value={input.projectType}
              options={copy.projectTypeOptions}
              onValueChange={(value) => updateInput("projectType", value as QuoteProjectType)}
            />
            <NumberField
              label={copy.squareMeters}
              description={copy.squareMetersDescription}
              value={input.squareMeters}
              min={1}
              max={5000}
              onChange={(event) => updateNumber("squareMeters", event, 1, 5000)}
            />
            <NumberField
              label={copy.floors}
              description={copy.floorsDescription}
              value={input.floors}
              min={1}
              max={20}
              onChange={(event) => updateNumber("floors", event, 1, 20)}
            />
            <NumberField
              label={copy.views}
              description={copy.viewsDescription}
              value={input.views}
              min={1}
              max={12}
              onChange={(event) => updateNumber("views", event, 1, 12)}
            />
            <NumberField
              label={copy.revisions}
              description={copy.revisionsDescription}
              value={input.revisions}
              min={0}
              max={8}
              onChange={(event) => updateNumber("revisions", event, 0, 8)}
            />
            <SelectField
              label={copy.complexity}
              value={input.complexity}
              options={copy.complexityOptions}
              onValueChange={(value) => updateInput("complexity", value as QuoteComplexity)}
            />
            <SelectField
              label={copy.delivery}
              value={input.deliverySpeed}
              options={copy.deliveryOptions}
              onValueChange={(value) => updateInput("deliverySpeed", value as QuoteDeliverySpeed)}
            />
          </FieldGroup>

          <FieldGroup className="mt-6">
            <Field orientation="horizontal">
              <Checkbox
                checked={input.sparsePlans}
                onCheckedChange={(checked) => updateInput("sparsePlans", checked)}
              />
              <FieldContent>
                <FieldTitle>{copy.sparsePlans}</FieldTitle>
                <FieldDescription>{copy.sparsePlansDescription}</FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                checked={input.advancedSiteContext}
                onCheckedChange={(checked) => updateInput("advancedSiteContext", checked)}
              />
              <FieldContent>
                <FieldTitle>{copy.advancedSiteContext}</FieldTitle>
                <FieldDescription>{copy.advancedSiteContextDescription}</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-between gap-4">
          <p className="text-sm text-muted-foreground">{copy.positioning}</p>
          <Badge variant="secondary">{copy.lowNormal}</Badge>
        </CardFooter>
      </Card>

      <Card className="rounded-lg lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>{copy.estimateTitle}</CardTitle>
          <CardDescription>{copy.estimateDescription}</CardDescription>
          <CardAction>
            <Badge variant={quote.requiresManualReview ? "outline" : "default"}>
              {quote.requiresManualReview ? copy.reviewBadge : copy.instantBadge}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {copy.recommendedQuote}
            </p>
            <div className="text-5xl font-semibold tracking-normal">
              {formatQuoteMoney(quote.totalCents, quote.config)}
            </div>
            <p className="text-sm text-muted-foreground">
              {copy.normalRange} {formatQuoteMoney(quote.lowCents, quote.config)} -{" "}
              {formatQuoteMoney(quote.highCents, quote.config)}
            </p>
          </div>

          <div className="grid gap-0 border-y text-sm">
            <SummaryRow
              label={copy.averagePerView}
              value={formatQuoteMoney(quote.averagePerViewCents, quote.config)}
            />
            <SummaryRow
              label={copy.multiplier}
              value={`${quote.multiplier.toFixed(2)}x`}
            />
            <SummaryRow
              label={copy.recommendedPackage}
              value={copy.packageLabels[quote.recommendedPackageSlug]}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalculatorIcon className="text-primary" />
              {copy.breakdown}
            </div>
            <div className="flex flex-col gap-2 text-sm">
              {quote.breakdown.map((line) => (
                <SummaryRow
                  key={line.key}
                  label={copy.breakdownLabels[line.key]}
                  value={formatQuoteMoney(line.amountCents, quote.config)}
                  compact
                />
              ))}
            </div>
          </div>

          {quote.requiresManualReview ? (
            <Alert>
              <InfoIcon />
              <AlertTitle>{copy.reviewTitle}</AlertTitle>
              <AlertDescription>
                {quote.manualReviewReasons
                  .map((reason) => copy.reviewReasons[reason] ?? reason)
                  .join(" ")}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={copySummary}>
            {copied ? <CheckIcon data-icon="inline-start" /> : <ClipboardIcon data-icon="inline-start" />}
            {copied ? copy.copied : copy.copyQuote}
          </Button>
          <Link
            href={localePath(locale, `/order?package=${quote.recommendedPackageSlug}`)}
            className={cn(buttonVariants(), "flex-1")}
          >
            {copy.startOrder}
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: { label: string; value: string }[]
  onValueChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select items={options} value={value} onValueChange={(nextValue) => onValueChange(String(nextValue))}>
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function NumberField({
  label,
  description,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  description: string
  value: number
  min: number
  max: number
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={label}>{label}</FieldLabel>
      <Input
        id={label}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
      />
      <FieldDescription>{description}</FieldDescription>
    </Field>
  )
}

function SummaryRow({
  label,
  value,
  compact = false,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div className={cn("flex justify-between gap-4", compact ? "py-1" : "py-3")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function createQuoteSummary(copy: QuoteCopy, quote: ReturnType<typeof calculateProjectQuote>) {
  const lines = [
    `Cuadrabot ${copy.quoteSummary}`,
    `${copy.market}: ${copy.marketOptions.find((option) => option.value === quote.input.market)?.label}`,
    `${copy.projectType}: ${copy.projectTypeOptions.find((option) => option.value === quote.input.projectType)?.label}`,
    `${copy.squareMeters}: ${quote.input.squareMeters} m2`,
    `${copy.views}: ${quote.input.views}`,
    `${copy.revisions}: ${quote.input.revisions}`,
    `${copy.complexity}: ${copy.complexityOptions.find((option) => option.value === quote.input.complexity)?.label}`,
    `${copy.delivery}: ${copy.deliveryOptions.find((option) => option.value === quote.input.deliverySpeed)?.label}`,
    `${copy.recommendedQuote}: ${formatQuoteMoney(quote.totalCents, quote.config)}`,
    `${copy.normalRange} ${formatQuoteMoney(quote.lowCents, quote.config)} - ${formatQuoteMoney(quote.highCents, quote.config)}`,
  ]

  return lines.filter(Boolean).join("\n")
}

function getQuoteCopy(locale: Locale) {
  const commonOptions = {
    marketOptions: [
      { label: "USA", value: "usa" },
      { label: "Espana", value: "spain" },
      { label: "Rep. Dom.", value: "dominican" },
    ],
    packageLabels: {
      "basic-render": "Basic Render",
      "pro-render": "Pro Render",
      "premium-render-pack": "Premium Render Pack",
    },
  }

  if (locale === "es") {
    return {
      ...commonOptions,
      formTitle: "Cotizador por proyecto",
      formDescription:
        "Calcula un precio por metraje, vistas, complejidad y urgencia sin eliminar los paquetes base.",
      market: "Mercado",
      projectType: "Tipo de proyecto",
      squareMeters: "Metraje estimado",
      squareMetersDescription: "Usa m2 aproximados del area a modelar o visualizar.",
      floors: "Plantas",
      floorsDescription: "Las plantas extra aumentan coordinacion y modelado.",
      views: "Vistas finales",
      viewsDescription: "Imagenes finales que se entregan al cliente.",
      revisions: "Rondas de revision",
      revisionsDescription: "La primera ronda esta incluida en la formula.",
      complexity: "Complejidad",
      delivery: "Entrega",
      sparsePlans: "Planos incompletos o bocetos",
      sparsePlansDescription: "Aplica cuando falta informacion y hay que interpretar mas.",
      advancedSiteContext: "Contexto exterior complejo",
      advancedSiteContextDescription: "Paisajismo, entorno urbano, piscinas o sitio amplio.",
      positioning:
        "La formula apunta a estar entre los baratos del mercado sin salir de un rango normal.",
      lowNormal: "Barato normal",
      estimateTitle: "Estimado instantaneo",
      estimateDescription: "Precio recomendado antes de revisar archivos.",
      reviewBadge: "Revisar",
      instantBadge: "Instantaneo",
      recommendedQuote: "Precio recomendado",
      normalRange: "Rango normal:",
      averagePerView: "Promedio por vista",
      multiplier: "Multiplicador de alcance",
      recommendedPackage: "Checkout sugerido",
      breakdown: "Desglose",
      reviewTitle: "Requiere revision manual",
      copyQuote: "Copiar cotizacion",
      copied: "Copiado",
      startOrder: "Iniciar pedido",
      quoteSummary: "cotizacion",
      projectTypeOptions: [
        { label: "Casa", value: "house" },
        { label: "Apartamento", value: "apartment" },
        { label: "Interior", value: "interior" },
        { label: "Remodelacion", value: "renovation" },
        { label: "Comercial", value: "commercial" },
        { label: "Desarrollo inmobiliario", value: "development" },
      ],
      complexityOptions: [
        { label: "Simple", value: "simple" },
        { label: "Estandar", value: "standard" },
        { label: "Detallado", value: "detailed" },
        { label: "Premium", value: "premium" },
      ],
      deliveryOptions: [
        { label: "3-5 dias", value: "standard" },
        { label: "Rush 48h", value: "rush48" },
        { label: "Rush 24h", value: "rush24" },
      ],
      breakdownLabels: {
        base: "Base del proyecto",
        area: "Metraje",
        views: "Vistas adicionales",
        revisions: "Revisiones adicionales",
        scopeMultiplier: "Complejidad y urgencia",
        minimumAdjustment: "Minimo del mercado",
      } satisfies Record<QuoteBreakdownLine["key"], string>,
      reviewReasons: {
        large_project: "El metraje supera el limite de cotizacion automatica.",
        many_views: "Hay mas de 6 vistas finales.",
        development_scope: "El desarrollo inmobiliario grande debe revisarse por alcance.",
        rush_scope: "La urgencia de 24h con muchas vistas necesita confirmacion.",
        premium_sparse_plans: "Premium con planos incompletos puede requerir mas modelado.",
      } as Record<string, string>,
    }
  }

  return {
    ...commonOptions,
    formTitle: "Project quote calculator",
    formDescription:
      "Estimate a project price from area, views, complexity, and urgency while keeping package pricing as the baseline.",
    market: "Market",
    projectType: "Project type",
    squareMeters: "Estimated area",
    squareMetersDescription: "Use approximate m2 for the area to model or visualize.",
    floors: "Floors",
    floorsDescription: "Extra floors add coordination and modeling work.",
    views: "Final views",
    viewsDescription: "Final rendered images delivered to the client.",
    revisions: "Revision rounds",
    revisionsDescription: "The first revision round is included in the formula.",
    complexity: "Complexity",
    delivery: "Delivery",
    sparsePlans: "Incomplete plans or sketches",
    sparsePlansDescription: "Use when information is missing and interpretation is required.",
    advancedSiteContext: "Complex exterior context",
    advancedSiteContextDescription: "Landscaping, urban context, pools, or a larger site.",
    positioning:
      "The formula aims to be among the cheaper options while staying inside a normal market range.",
    lowNormal: "Low normal",
    estimateTitle: "Instant estimate",
    estimateDescription: "Recommended price before reviewing files.",
    reviewBadge: "Review",
    instantBadge: "Instant",
    recommendedQuote: "Recommended quote",
    normalRange: "Normal range:",
    averagePerView: "Average per view",
    multiplier: "Scope multiplier",
    recommendedPackage: "Suggested checkout",
    breakdown: "Breakdown",
    reviewTitle: "Manual review needed",
    copyQuote: "Copy quote",
    copied: "Copied",
    startOrder: "Start order",
    quoteSummary: "quote",
    projectTypeOptions: [
      { label: "House", value: "house" },
      { label: "Apartment", value: "apartment" },
      { label: "Interior", value: "interior" },
      { label: "Renovation", value: "renovation" },
      { label: "Commercial", value: "commercial" },
      { label: "Real estate development", value: "development" },
    ],
    complexityOptions: [
      { label: "Simple", value: "simple" },
      { label: "Standard", value: "standard" },
      { label: "Detailed", value: "detailed" },
      { label: "Premium", value: "premium" },
    ],
    deliveryOptions: [
      { label: "3-5 days", value: "standard" },
      { label: "Rush 48h", value: "rush48" },
      { label: "Rush 24h", value: "rush24" },
    ],
    breakdownLabels: {
      base: "Project base",
      area: "Area",
      views: "Additional views",
      revisions: "Additional revisions",
      scopeMultiplier: "Complexity and urgency",
      minimumAdjustment: "Market minimum",
    } satisfies Record<QuoteBreakdownLine["key"], string>,
    reviewReasons: {
      large_project: "Area exceeds the automatic quoting limit.",
      many_views: "There are more than 6 final views.",
      development_scope: "Large development work should be reviewed for scope.",
      rush_scope: "A 24h rush with many views needs confirmation.",
      premium_sparse_plans: "Premium work with incomplete plans may require more modeling.",
    } as Record<string, string>,
  }
}

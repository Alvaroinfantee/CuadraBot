"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRightIcon, FileUpIcon, Loader2Icon, XIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import {
  allowedUploadExtensions,
  orderDetailsSchema,
  validateUploadFile,
} from "@/lib/schemas"
import { formatDeliveryRange, formatMoney } from "@/lib/format"
import { maxUploadMb } from "@/lib/config"
import {
  commonCopy,
  getPackageDisplay,
  type Locale,
} from "@/lib/i18n"
import {
  projectTypes,
  renderTypes,
  stylePreferences,
  type PackagePlan,
} from "@/lib/types"
import { cn } from "@/lib/utils"

type OrderFormValues = z.infer<typeof orderDetailsSchema>
type OrderFormInput = z.input<typeof orderDetailsSchema>

export function OrderFlow({
  packages,
  initialPackageSlug,
  focusUpload = false,
  locale = "en",
}: {
  packages: PackagePlan[]
  initialPackageSlug?: string
  focusUpload?: boolean
  locale?: Locale
}) {
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const packageSlug =
    packages.find((plan) => plan.slug === initialPackageSlug)?.slug ?? packages[0]?.slug

  const form = useForm<OrderFormInput, unknown, OrderFormValues>({
    resolver: zodResolver(orderDetailsSchema),
    defaultValues: {
      package_slug: packageSlug,
      render_type: "Exterior",
      project_type: "House",
      style_preference: "Modern",
      number_of_floors: undefined,
      estimated_square_meters: undefined,
      deadline_preference: "",
      customer_notes: "",
      customer_name: "",
      customer_email: "",
    },
  })

  const selectedPackageSlug = useWatch({
    control: form.control,
    name: "package_slug",
  })
  const selectedRenderType = useWatch({ control: form.control, name: "render_type" })
  const selectedProjectType = useWatch({ control: form.control, name: "project_type" })
  const selectedStylePreference = useWatch({
    control: form.control,
    name: "style_preference",
  })
  const selectedPackage = packages.find((plan) => plan.slug === selectedPackageSlug)
  const copy = getOrderCopy(locale)
  const common = commonCopy[locale]

  const acceptedLabel = useMemo(
    () => allowedUploadExtensions.map((extension) => `.${extension}`).join(", "),
    []
  )

  async function onSubmit(values: OrderFormValues) {
    if (!files.length) {
      toast.error(copy.errors.noFiles)
      return
    }

    for (const file of files) {
      const validationError = validateUploadFile(file.name, file.type || "application/octet-stream", file.size)
      if (validationError) {
        toast.error(validationError)
        return
      }
    }

    setIsSubmitting(true)
    setProgress(5)

    try {
      const draftResponse = await fetch("/api/orders/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      })

      const draft = await draftResponse.json()

      if (!draftResponse.ok) {
        throw new Error(draft.error ?? copy.errors.createOrder)
      }

      const supabase = createSupabaseBrowserClient()
      const order = draft.order as {
        id: string
        public_token: string
        order_number: string
      }

      for (const [index, file] of files.entries()) {
        const signResponse = await fetch(`/api/orders/${order.id}/files/sign`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-order-token": order.public_token,
          },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        })

        const signed = await signResponse.json()
        if (!signResponse.ok) {
          throw new Error(signed.error ?? `${copy.errors.prepareUpload} ${file.name}.`)
        }

        const { error: uploadError } = await supabase.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file)

        if (uploadError) {
          throw new Error(uploadError.message)
        }

        setProgress(Math.round(((index + 1) / files.length) * 75) + 10)
      }

      const checkoutResponse = await fetch(`/api/orders/${order.id}/checkout`, {
        method: "POST",
        headers: {
          "x-order-token": order.public_token,
          "x-locale": locale,
        },
      })
      const checkout = await checkoutResponse.json()

      if (!checkoutResponse.ok) {
        throw new Error(checkout.error ?? copy.errors.checkout)
      }

      setProgress(100)
      window.location.assign(checkout.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.errors.generic)
      setIsSubmitting(false)
      setProgress(0)
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const next = Array.from(fileList)
    setFiles((current) => [...current, ...next])
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-10 lg:grid-cols-[0.78fr_0.42fr]">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-5 border-b pb-8">
          <h2 className="text-2xl font-semibold tracking-normal">{copy.projectDetails}</h2>
          <FieldGroup className="grid gap-5 md:grid-cols-2">
            <SelectField
              label={copy.package}
              value={selectedPackageSlug}
              onValueChange={(value) => form.setValue("package_slug", value, { shouldValidate: true })}
              options={packages.map((plan) => ({
                label: `${getPackageDisplay(locale, plan).name} - ${formatMoney(plan.price_cents, plan.currency)}`,
                value: plan.slug,
              }))}
              error={form.formState.errors.package_slug?.message}
            />
            <SelectField
              label={copy.renderType}
              value={selectedRenderType}
              onValueChange={(value) => form.setValue("render_type", value as OrderFormValues["render_type"], { shouldValidate: true })}
              options={renderTypes.map((value) => ({ label: copy.options[value] ?? value, value }))}
              error={form.formState.errors.render_type?.message}
            />
            <SelectField
              label={copy.projectType}
              value={selectedProjectType}
              onValueChange={(value) => form.setValue("project_type", value as OrderFormValues["project_type"], { shouldValidate: true })}
              options={projectTypes.map((value) => ({ label: copy.options[value] ?? value, value }))}
              error={form.formState.errors.project_type?.message}
            />
            <SelectField
              label={copy.stylePreference}
              value={selectedStylePreference}
              onValueChange={(value) => form.setValue("style_preference", value as OrderFormValues["style_preference"], { shouldValidate: true })}
              options={stylePreferences.map((value) => ({ label: copy.options[value] ?? value, value }))}
              error={form.formState.errors.style_preference?.message}
            />
            <Field data-invalid={Boolean(form.formState.errors.number_of_floors)}>
              <FieldLabel htmlFor="number_of_floors">{copy.numberOfFloors}</FieldLabel>
              <Input
                id="number_of_floors"
                type="number"
                min="1"
                max="100"
                {...form.register("number_of_floors")}
                aria-invalid={Boolean(form.formState.errors.number_of_floors)}
              />
              <FieldError errors={[form.formState.errors.number_of_floors]} />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.estimated_square_meters)}>
              <FieldLabel htmlFor="estimated_square_meters">{copy.squareMeters}</FieldLabel>
              <Input
                id="estimated_square_meters"
                type="number"
                min="1"
                {...form.register("estimated_square_meters")}
                aria-invalid={Boolean(form.formState.errors.estimated_square_meters)}
              />
              <FieldError errors={[form.formState.errors.estimated_square_meters]} />
            </Field>
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor="deadline_preference">{copy.deadline}</FieldLabel>
            <Input
              id="deadline_preference"
              placeholder={copy.deadlinePlaceholder}
              {...form.register("deadline_preference")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="customer_notes">{copy.notes}</FieldLabel>
            <Textarea
              id="customer_notes"
              rows={6}
              placeholder={copy.notesPlaceholder}
              {...form.register("customer_notes")}
            />
          </Field>
        </section>

        <section className={cn("flex flex-col gap-5 border-b pb-8", focusUpload && "blueprint-fine-grid p-6")}>
          <h2 className="text-2xl font-semibold tracking-normal">{copy.uploadFiles}</h2>
          <Field>
            <FieldLabel htmlFor="files">{copy.blueprints}</FieldLabel>
            <label
              htmlFor="files"
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-4 border border-dashed bg-background p-8 text-center transition-colors hover:bg-muted/50"
            >
              <FileUpIcon className="text-primary" />
              <span className="font-medium">{copy.chooseFiles}</span>
              <span className="max-w-lg text-sm leading-6 text-muted-foreground">
                {copy.accepts} {acceptedLabel}. {copy.maxUpload} {maxUploadMb}MB.
              </span>
            </label>
            <Input
              id="files"
              type="file"
              multiple
              accept={acceptedLabel}
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
            />
            <FieldDescription>
              {copy.privateFiles}
            </FieldDescription>
          </Field>
          {files.length ? (
            <div className="flex flex-col gap-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 border px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <XIcon />
                    <span className="sr-only">{copy.remove} {file.name}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="text-2xl font-semibold tracking-normal">{copy.contact}</h2>
          <FieldGroup className="grid gap-5 md:grid-cols-2">
            <Field data-invalid={Boolean(form.formState.errors.customer_name)}>
              <FieldLabel htmlFor="customer_name">{copy.name}</FieldLabel>
              <Input
                id="customer_name"
                {...form.register("customer_name")}
                aria-invalid={Boolean(form.formState.errors.customer_name)}
              />
              <FieldError errors={[form.formState.errors.customer_name]} />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.customer_email)}>
              <FieldLabel htmlFor="customer_email">{copy.email}</FieldLabel>
              <Input
                id="customer_email"
                type="email"
                {...form.register("customer_email")}
                aria-invalid={Boolean(form.formState.errors.customer_email)}
              />
              <FieldError errors={[form.formState.errors.customer_email]} />
            </Field>
          </FieldGroup>
        </section>
      </div>

      <aside className="h-fit border bg-background p-6 lg:sticky lg:top-24">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{common.selectedPackage}</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {selectedPackage ? getPackageDisplay(locale, selectedPackage).name : null}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {selectedPackage ? getPackageDisplay(locale, selectedPackage).description : null}
            </p>
          </div>
          {selectedPackage ? (
            <div className="flex flex-col gap-2 border-y py-5 text-sm">
              <div className="flex justify-between gap-4">
                <span>{common.views}</span>
                <span className="font-medium">{selectedPackage.included_views}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{common.revisions}</span>
                <span className="font-medium">{selectedPackage.revision_rounds}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{common.estimate}</span>
                <span className="font-medium">
                  {formatDeliveryRange(
                    selectedPackage.estimated_delivery_days_min,
                    selectedPackage.estimated_delivery_days_max,
                    locale
                  )}
                </span>
              </div>
            </div>
          ) : null}
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm text-muted-foreground">{common.dueToday}</span>
            <span className="text-3xl font-semibold">
              {selectedPackage
                ? formatMoney(selectedPackage.price_cents, selectedPackage.currency)
                : "-"}
            </span>
          </div>
          {isSubmitting ? (
            <div className="flex flex-col gap-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {copy.uploading}
              </p>
            </div>
          ) : null}
          <Button type="submit" size="lg" className="h-12" disabled={isSubmitting}>
            {isSubmitting ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
            {copy.continueCheckout}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            {copy.paymentNote}
          </p>
        </div>
      </aside>
    </form>
  )
}

function getOrderCopy(locale: Locale) {
  if (locale === "es") {
    return {
      projectDetails: "Detalles del proyecto",
      package: "Paquete",
      renderType: "Tipo de render",
      projectType: "Tipo de proyecto",
      stylePreference: "Estilo preferido",
      numberOfFloors: "Número de plantas",
      squareMeters: "Metros cuadrados estimados",
      deadline: "Preferencia de fecha límite",
      deadlinePlaceholder: "Ejemplo: Lo necesito antes del 14 de junio",
      notes: "Notas e instrucciones",
      notesPlaceholder:
        "Cuéntanos sobre ángulos de cámara, materiales, referencias de estilo, contexto del sitio o lo que deba destacar el render.",
      uploadFiles: "Subir archivos",
      blueprints: "Planos y referencias",
      chooseFiles: "Elige archivos o arrástralos aquí",
      accepts: "Acepta",
      maxUpload: "El máximo por pedido es",
      privateFiles:
        "Los archivos permanecen privados y luego los descarga el worker local autenticado.",
      remove: "Quitar",
      contact: "Contacto",
      name: "Nombre",
      email: "Email",
      uploading: "Subiendo archivos y preparando el checkout seguro.",
      continueCheckout: "Continuar al pago seguro",
      paymentNote:
        "El pago se confirma del lado del servidor mediante webhook de Stripe antes de que el trabajo entre en la cola de renderizado.",
      errors: {
        noFiles: "Sube al menos un plano o archivo de referencia.",
        createOrder: "No se pudo crear el pedido.",
        prepareUpload: "No se pudo preparar la subida de",
        checkout: "No se pudo crear la sesión de Stripe Checkout.",
        generic: "Algo salió mal.",
      },
      options: {
        Exterior: "Exterior",
        Interior: "Interior",
        "Floor plan visualization": "Visualización de planta",
        "Site/massing": "Sitio/volumetría",
        Other: "Otro",
        House: "Casa",
        Apartment: "Apartamento",
        Commercial: "Comercial",
        "Real estate development": "Promoción inmobiliaria",
        Renovation: "Reforma",
        Modern: "Moderno",
        Minimal: "Minimalista",
        Luxury: "Lujo",
        Mediterranean: "Mediterráneo",
        Tropical: "Tropical",
        Realistic: "Realista",
        Conceptual: "Conceptual",
      } as Record<string, string>,
    }
  }

  return {
    projectDetails: "Project details",
    package: "Package",
    renderType: "Render type",
    projectType: "Project type",
    stylePreference: "Style preference",
    numberOfFloors: "Number of floors",
    squareMeters: "Estimated square meters",
    deadline: "Deadline preference",
    deadlinePlaceholder: "Example: Needed before June 14",
    notes: "Notes and instructions",
    notesPlaceholder:
      "Tell us about camera angles, materials, style references, site context, or anything the render should emphasize.",
    uploadFiles: "Upload files",
    blueprints: "Blueprints and references",
    chooseFiles: "Choose files or drop them here",
    accepts: "Accepts",
    maxUpload: "Maximum order upload is",
    privateFiles:
      "Files stay private and are later downloaded by the authenticated local rendering worker.",
    remove: "Remove",
    contact: "Contact",
    name: "Name",
    email: "Email",
    uploading: "Uploading files and preparing secure checkout.",
    continueCheckout: "Continue to secure checkout",
    paymentNote:
      "Payment is confirmed server-side by Stripe webhook before any job enters the rendering queue.",
    errors: {
      noFiles: "Upload at least one blueprint or reference file.",
      createOrder: "Could not create order.",
      prepareUpload: "Could not prepare upload for",
      checkout: "Could not create Stripe Checkout session.",
      generic: "Something went wrong.",
    },
    options: {} as Record<string, string>,
  }
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
  error,
}: {
  label: string
  value?: string
  onValueChange: (value: string) => void
  options: { label: string; value: string }[]
  error?: string
}) {
  return (
    <Field data-invalid={Boolean(error)}>
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
      <FieldError errors={error ? [{ message: error }] : undefined} />
    </Field>
  )
}

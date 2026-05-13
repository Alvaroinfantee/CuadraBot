import { z } from "zod"
import {
  projectTypes,
  renderTypes,
  stylePreferences,
  orderStatuses,
} from "@/lib/types"
import { maxUploadBytes, maxUploadMb } from "@/lib/config"

const optionalPositiveNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? value : parsed
}, z.number().positive().optional())

export const orderDetailsSchema = z.object({
  package_slug: z.string().min(1, "Choose a rendering package."),
  render_type: z.enum(renderTypes),
  project_type: z.enum(projectTypes),
  style_preference: z.enum(stylePreferences),
  number_of_floors: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return undefined
    const parsed = Number(value)
    return Number.isNaN(parsed) ? value : parsed
  }, z.number().int().positive().max(100).optional()),
  estimated_square_meters: optionalPositiveNumber,
  deadline_preference: z.string().max(120).optional().nullable(),
  customer_notes: z.string().max(2500).optional().nullable(),
  customer_name: z.string().min(2, "Enter your name.").max(120),
  customer_email: z.email("Enter a valid email address.").max(255),
})

export const fileSignSchema = z.object({
  filename: z.string().min(1).max(220),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(maxUploadBytes, {
    message: `Files must be ${maxUploadMb}MB or smaller.`,
  }),
})

export const workerStatusSchema = z.object({
  status: z.enum(orderStatuses),
  logs: z.string().max(20000).optional(),
  error_message: z.string().max(5000).optional(),
})

export const adminStatusSchema = z.object({
  status: z.enum(orderStatuses),
  internal_notes: z.string().max(20000).optional(),
})

export const allowedUploadExtensions = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "dwg",
  "dxf",
  "zip",
]

export const allowedUploadMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "image/vnd.dwg",
  "image/vnd.dxf",
]

export function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? ""
}

export function validateUploadFile(filename: string, mimeType: string, size: number) {
  const extension = getFileExtension(filename)

  if (!allowedUploadExtensions.includes(extension)) {
    return `Unsupported file type. Upload PDF, PNG, JPG, DWG, DXF, or ZIP files.`
  }

  if (!allowedUploadMimeTypes.includes(mimeType) && extension !== "dwg" && extension !== "dxf") {
    return `Unsupported MIME type: ${mimeType}`
  }

  if (size > maxUploadBytes) {
    return `Files must be ${maxUploadMb}MB or smaller.`
  }

  return null
}

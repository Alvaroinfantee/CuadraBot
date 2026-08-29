import { z } from "zod"
import {
  drywallMaxFiles,
  drywallMaxUploadBytes,
} from "@/lib/config"

const attributionValue = z.string().trim().max(500)

export const drywallFileSchema = z.object({
  filename: z.string().trim().min(1).max(220),
  mimeType: z
    .string()
    .refine(
      (value) =>
        value === "application/pdf" || value === "application/octet-stream",
      "Solo se aceptan archivos PDF."
    ),
  sizeBytes: z.number().int().min(5).max(drywallMaxUploadBytes),
})

export const drywallDraftSchema = z
  .object({
    email: z.string().trim().email().max(254),
    company: z.string().trim().max(160).optional().default(""),
    projectName: z.string().trim().min(2).max(160),
    location: z.string().trim().min(2).max(160),
    projectType: z.enum([
      "vivienda",
      "oficinas",
      "comercial",
      "hotel",
      "hospital",
      "aeropuerto",
      "industrial_complejo",
      "otro",
    ]),
    bidDate: z.string().date().optional().or(z.literal("")),
    notes: z.string().trim().max(4_000).optional().default(""),
    sessionId: z.string().trim().max(160).optional().default(""),
    marketing: z.record(z.string(), attributionValue).optional().default({}),
    files: z.array(drywallFileSchema).min(1).max(drywallMaxFiles),
  })
  .superRefine((value, context) => {
    const total = value.files.reduce((sum, file) => sum + file.sizeBytes, 0)
    if (total > drywallMaxUploadBytes) {
      context.addIssue({
        code: "custom",
        path: ["files"],
        message: "El conjunto de planos supera el límite de carga.",
      })
    }
  })

const scopeAnswer = z.string().trim().max(2_000)

export const drywallCheckoutSchema = z.object({
  accessToken: z.string().min(32).max(256),
  acceptedScope: z.literal(true),
  uploadAuthority: z.literal(true),
  selectedPages: z
    .array(
      z.object({
        fileId: z.string().uuid(),
        pageNumbers: z.array(z.number().int().min(1).max(500)).min(1),
      })
    )
    .min(1)
    .max(10),
  scope: z.object({
    partitions: scopeAnswer,
    ceilings: scopeAnswer,
    wallSchedules: scopeAnswer,
    reflectedCeilings: scopeAnswer,
    visibleScale: scopeAnswer,
    defaultHeight: scopeAnswer,
    deductOpenings: scopeAnswer,
    supersededDrawings: scopeAnswer,
    excludedAreas: scopeAnswer,
    estimatorNotes: scopeAnswer,
  }),
})

export const drywallTokenSchema = z.object({
  accessToken: z.string().min(32).max(256),
})

export const drywallRevisionSchema = z.object({
  token: z.string().min(32).max(512),
  category: z.enum([
    "incorrect_quantity",
    "missing_area",
    "classification",
    "opening",
    "assumption",
    "file",
    "other",
  ]),
  drawingPage: z.string().trim().min(1).max(120),
  area: z.string().trim().min(1).max(160),
  measurementId: z.string().trim().min(1).max(160),
  description: z.string().trim().min(12).max(4_000),
})

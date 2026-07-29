import { z } from "zod"
import { maxUploadBytes, maxUploadMb } from "@/lib/config"
import { selectableTakeoffTrades } from "@/lib/takeoff-types"

export const takeoffDraftSchema = z.object({
  projectName: z.string().trim().min(2).max(120),
  mode: z.enum(["sample", "standard"]).default("standard"),
  trades: z.array(z.enum(selectableTakeoffTrades)).min(1).max(2),
  notes: z.string().trim().max(4_000).optional().default(""),
  samplePage: z.number().int().positive().max(250).optional(),
  filename: z.string().trim().min(1).max(220),
  mimeType: z
    .string()
    .refine(
      (value) =>
        value === "application/pdf" || value === "application/octet-stream",
      "Upload a PDF plan set."
    ),
  sizeBytes: z.number().int().positive().max(maxUploadBytes, {
    message: `Plans must be ${maxUploadMb}MB or smaller.`,
  }),
})

export const takeoffSubmitSchema = z.object({
  samplePage: z.number().int().positive().max(250).optional(),
  confirm: z.boolean().default(false),
})

export const takeoffProgressSchema = z.object({
  stage: z.string().trim().min(1).max(80),
  progress: z.number().int().min(0).max(100),
  message: z.string().trim().max(1_000).optional(),
  microserviceJobId: z.string().trim().max(160).optional(),
})

export const takeoffFailureSchema = z.object({
  stage: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(5_000),
  retryable: z.boolean().default(false),
})

const mebibyte = 1024 * 1024

// The download/upload route uses this as an absolute streaming safety cap.
// Descriptor validation below applies the tighter format-specific limits.
export const maxTakeoffArtifactBytes = 250 * mebibyte

export const takeoffArtifactMediaTypes = {
  "takeoff.json": "application/json",
  "takeoff.xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "methodology.json": "application/json",
  "annotated_drawings.pdf": "application/pdf",
  "annotation_audit.json": "application/json",
} as const

export type TakeoffArtifactFilename =
  keyof typeof takeoffArtifactMediaTypes

export const maxTakeoffArtifactBytesByFilename: Record<
  TakeoffArtifactFilename,
  number
> = {
  "takeoff.json": 50 * mebibyte,
  "takeoff.xlsx": 100 * mebibyte,
  "methodology.json": 50 * mebibyte,
  "annotated_drawings.pdf": 250 * mebibyte,
  "annotation_audit.json": 50 * mebibyte,
}

export const customerTakeoffDeliverableFilenames = [
  "annotated_drawings.pdf",
  "takeoff.xlsx",
] as const satisfies readonly TakeoffArtifactFilename[]

export type CustomerTakeoffDeliverableFilename =
  (typeof customerTakeoffDeliverableFilenames)[number]

export function isCustomerTakeoffDeliverableFilename(
  value: string
): value is CustomerTakeoffDeliverableFilename {
  return customerTakeoffDeliverableFilenames.some(
    (filename) => filename === value
  )
}

export type TakeoffArtifactDescriptor = {
  filename: TakeoffArtifactFilename
  mediaType: (typeof takeoffArtifactMediaTypes)[TakeoffArtifactFilename]
  bytes: number
  sha256: string
}

export type ArtifactDescriptorParseResult =
  | { success: true; data: TakeoffArtifactDescriptor[] }
  | { success: false; error: string }

export function parseTakeoffArtifactDescriptors(
  value: unknown
): ArtifactDescriptorParseResult {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > Object.keys(takeoffArtifactMediaTypes).length
  ) {
    return {
      success: false,
      error: "Between one and five artifact descriptors are required.",
    }
  }

  const descriptors: TakeoffArtifactDescriptor[] = []
  const filenames = new Set<string>()

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") {
      return { success: false, error: "Artifact descriptors must be objects." }
    }

    const descriptor = candidate as Record<string, unknown>
    const filename = descriptor.filename
    if (
      typeof filename !== "string" ||
      !Object.hasOwn(takeoffArtifactMediaTypes, filename)
    ) {
      return { success: false, error: `Unsupported artifact: ${filename}` }
    }

    if (filenames.has(filename)) {
      return {
        success: false,
        error: `Duplicate artifact descriptor: ${filename}`,
      }
    }
    filenames.add(filename)

    const expectedMediaType =
      takeoffArtifactMediaTypes[filename as TakeoffArtifactFilename]
    if (descriptor.mediaType !== expectedMediaType) {
      return {
        success: false,
        error: `Unsupported media type for ${filename}.`,
      }
    }

    if (
      !Number.isSafeInteger(descriptor.bytes) ||
      Number(descriptor.bytes) < 1 ||
      Number(descriptor.bytes) >
        maxTakeoffArtifactBytesByFilename[
          filename as TakeoffArtifactFilename
        ]
    ) {
      return {
        success: false,
        error: `Artifact size is invalid for ${filename}.`,
      }
    }

    if (
      typeof descriptor.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(descriptor.sha256)
    ) {
      return {
        success: false,
        error: `Artifact SHA-256 is invalid for ${filename}.`,
      }
    }

    descriptors.push({
      filename: filename as TakeoffArtifactFilename,
      mediaType: expectedMediaType,
      bytes: Number(descriptor.bytes),
      sha256: descriptor.sha256.toLowerCase(),
    })
  }

  return { success: true, data: descriptors }
}

export function takeoffArtifactRole(
  filename: TakeoffArtifactFilename
): "manifest" | "result" {
  return filename.endsWith(".json") ? "manifest" : "result"
}

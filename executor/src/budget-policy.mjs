export const BUDGET_CLASSES = Object.freeze([
  "free_sample",
  "first_verified",
  "essential",
  "professional",
  "multi_trade",
  "large_set",
])

export const BUDGET_PROFILES = deepFreeze({
  free_sample: {
    maxCostMicros: 10_000_000,
    maxRequestBytes: 256 * 1024 * 1024,
    maxOutputTokens: 80_000,
    maxOutputTokensPerRequest: 12_000,
    maxRequests: 48,
  },
  first_verified: {
    maxCostMicros: 10_000_000,
    maxRequestBytes: 384 * 1024 * 1024,
    maxOutputTokens: 160_000,
    maxOutputTokensPerRequest: 16_000,
    maxRequests: 96,
  },
  essential: {
    maxCostMicros: 20_000_000,
    maxRequestBytes: 512 * 1024 * 1024,
    maxOutputTokens: 320_000,
    maxOutputTokensPerRequest: 20_000,
    maxRequests: 160,
  },
  professional: {
    maxCostMicros: 35_000_000,
    maxRequestBytes: 768 * 1024 * 1024,
    maxOutputTokens: 550_000,
    maxOutputTokensPerRequest: 24_000,
    maxRequests: 256,
  },
  multi_trade: {
    maxCostMicros: 60_000_000,
    maxRequestBytes: 1024 * 1024 * 1024,
    maxOutputTokens: 800_000,
    maxOutputTokensPerRequest: 32_000,
    maxRequests: 384,
  },
  large_set: {
    maxCostMicros: 100_000_000,
    maxRequestBytes: 2 * 1024 * 1024 * 1024,
    maxOutputTokens: 1_000_000,
    maxOutputTokensPerRequest: 32_000,
    maxRequests: 512,
  },
})

// Micro-USD per token. Admission uses the maximum 1.25x cache-write input rate
// on top of the long-context multiplier. Actual reporting remains the requested
// all-uncached counterfactual and explicit cache controls are rejected.
export const MODEL_COST_RATES = deepFreeze({
  "gpt-5.6-sol": {
    inputMicros: 5,
    outputMicros: 30,
    longInputMicros: 10,
    longOutputMicros: 45,
    reservationInputMicros: 12.5,
  },
  "gpt-5.6-terra": {
    inputMicros: 2,
    outputMicros: 12,
    longInputMicros: 4,
    longOutputMicros: 18,
    reservationInputMicros: 5,
  },
  "gpt-5.6-luna": {
    inputMicros: 0.2,
    outputMicros: 1.2,
    longInputMicros: 0.4,
    longOutputMicros: 1.8,
    reservationInputMicros: 0.5,
  },
})

export const LONG_CONTEXT_INPUT_THRESHOLD = 272_000
export const DEFAULT_IMAGE_PATCH_TOKEN_MULTIPLIER = 4
export const DEFAULT_MAX_DATA_IMAGES = 8
export const DEFAULT_MAX_DATA_IMAGE_BYTES = 11 * 1024 * 1024
export const REQUEST_NORMALIZATION_OVERHEAD_BYTES = 1024

export function isBudgetClass(value) {
  return typeof value === "string" && BUDGET_CLASSES.includes(value)
}

export function budgetProfile(value) {
  if (!isBudgetClass(value)) throw new Error("Unknown executor budget class")
  return BUDGET_PROFILES[value]
}

export function reservationCostMicros({
  model,
  estimatedInputTokens,
  outputTokens,
}) {
  const rates = MODEL_COST_RATES[model]
  if (!rates) throw new Error("Unknown model cost rates")
  if (
    !Number.isSafeInteger(estimatedInputTokens) ||
    estimatedInputTokens < 1 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 1
  ) {
    throw new Error("Invalid cost reservation")
  }
  return Math.ceil(
    estimatedInputTokens * rates.reservationInputMicros +
      outputTokens * rates.longOutputMicros
  )
}

// Admission treats every ordinary UTF-8 byte as a token. A
// validated Responses input_image data URI is reserved from its original
// dimensions at four tokens per 32px patch (above documented multipliers), not
// from its base64 bytes. Completed Responses usage is the authoritative debit.
export function estimateRequestInputTokens(
  body,
  rawRequestBytes,
  {
    imagePatchTokenMultiplier = DEFAULT_IMAGE_PATCH_TOKEN_MULTIPLIER,
    maxDataImages = DEFAULT_MAX_DATA_IMAGES,
    maxDataImageBytes = DEFAULT_MAX_DATA_IMAGE_BYTES,
  } = {}
) {
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object" ||
    !Number.isSafeInteger(rawRequestBytes) ||
    rawRequestBytes < 1 ||
    !Number.isSafeInteger(imagePatchTokenMultiplier) ||
    imagePatchTokenMultiplier < 1 ||
    !Number.isSafeInteger(maxDataImages) ||
    maxDataImages < 1 ||
    !Number.isSafeInteger(maxDataImageBytes) ||
    maxDataImageBytes < 1
  ) {
    throw new Error("Invalid request admission input")
  }

  let imageCount = 0
  let encodedImageBytes = 0
  let reservedImageTokens = 0
  walk(body, (candidate) => {
    if (candidate.type === "input_file") {
      throw statusError(400, "Account-scoped and remote input files are not allowed")
    }
    if (candidate.type !== "input_image") return
    if (candidate.detail !== "high") {
      throw statusError(400, "Input images must use bounded high detail")
    }
    if (typeof candidate.image_url !== "string") {
      throw statusError(400, "Input images must use bounded data image URLs")
    }
    const image = parseDataImage(candidate.image_url)
    if (image.decodedBytes > maxDataImageBytes) {
      throw statusError(413, "Input image exceeds the per-image limit")
    }
    imageCount += 1
    if (imageCount > maxDataImages) {
      throw statusError(400, "Too many input images in one Responses request")
    }
    encodedImageBytes += Buffer.byteLength(candidate.image_url)
    reservedImageTokens += image.patchCount * imagePatchTokenMultiplier
  })

  const nonImageBytes = Math.max(
    1,
    rawRequestBytes -
      encodedImageBytes +
      REQUEST_NORMALIZATION_OVERHEAD_BYTES
  )
  return {
    estimatedInputTokens: nonImageBytes + reservedImageTokens,
    imageCount,
    encodedImageBytes,
    reservedImageTokens,
  }
}

export function forceBoundedImageDetail(body) {
  walk(body, (candidate) => {
    if (candidate.type === "input_image") candidate.detail = "high"
  })
  return body
}

export function usageCostMicros({ model, inputTokens, outputTokens }) {
  const rates = MODEL_COST_RATES[model]
  if (!rates) throw new Error("Unknown model cost rates")
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0
  ) {
    throw new Error("Invalid usage accounting")
  }
  const longContext = inputTokens > LONG_CONTEXT_INPUT_THRESHOLD
  return Math.ceil(
    inputTokens *
      (longContext ? rates.longInputMicros : rates.inputMicros) +
      outputTokens *
        (longContext ? rates.longOutputMicros : rates.outputMicros)
  )
}

export function enforcementUsageCostMicros({
  model,
  inputTokens,
  outputTokens,
}) {
  const rates = MODEL_COST_RATES[model]
  if (!rates) throw new Error("Unknown model cost rates")
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0
  ) {
    throw new Error("Invalid usage accounting")
  }
  const longContext = inputTokens > LONG_CONTEXT_INPUT_THRESHOLD
  return Math.ceil(
    inputTokens * rates.reservationInputMicros +
      outputTokens *
        (longContext ? rates.longOutputMicros : rates.outputMicros)
  )
}

function deepFreeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") deepFreeze(nested)
  }
  return Object.freeze(value)
}

function walk(value, visitor) {
  if (!value || typeof value !== "object") return
  visitor(value)
  if (Array.isArray(value)) {
    for (const nested of value) walk(nested, visitor)
    return
  }
  for (const nested of Object.values(value)) walk(nested, visitor)
}

function parseDataImage(value) {
  const match = value.match(
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/
  )
  if (!match || !match[2] || match[2].length % 4 !== 0) {
    throw statusError(400, "Input images must be canonical base64 data images")
  }
  const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0
  const decodedBytes = (match[2].length / 4) * 3 - padding
  if (!Number.isSafeInteger(decodedBytes) || decodedBytes < 1) {
    throw statusError(400, "Input image payload is invalid")
  }
  const bytes = Buffer.from(match[2], "base64")
  if (bytes.length !== decodedBytes) {
    throw statusError(400, "Input image payload is invalid")
  }
  const dimensions = imageDimensions(match[1], bytes)
  const { width, height } = dimensions
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 100_000 ||
    height > 100_000
  ) {
    throw statusError(400, "Input image dimensions are invalid")
  }
  const patchCount = Math.ceil(width / 32) * Math.ceil(height / 32)
  if (!Number.isSafeInteger(patchCount) || patchCount < 1) {
    throw statusError(400, "Input image patch count is invalid")
  }
  return { decodedBytes, width, height, patchCount }
}

function imageDimensions(type, bytes) {
  if (type === "png") {
    if (
      bytes.length < 24 ||
      !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      bytes.readUInt32BE(8) !== 13 ||
      bytes.subarray(12, 16).toString("ascii") !== "IHDR"
    ) {
      throw statusError(400, "Input PNG header is invalid")
    }
    if (pngHasAnimation(bytes)) {
      throw statusError(400, "Animated PNG images are not allowed")
    }
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  if (type === "jpeg") return jpegDimensions(bytes)
  if (type === "webp") return webpDimensions(bytes)
  throw statusError(400, "Input image type is invalid")
}

function pngHasAnimation(bytes) {
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    if (length > bytes.length - offset - 12) return false
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii")
    if (type === "acTL") return true
    if (type === "IEND") return false
    offset += length + 12
  }
  return false
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw statusError(400, "Input JPEG header is invalid")
  }
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ])
  let offset = 2
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1
    if (offset >= bytes.length) break
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }
    if (offset + 2 > bytes.length) break
    const length = bytes.readUInt16BE(offset)
    if (length < 2 || offset + length > bytes.length) break
    if (startOfFrame.has(marker) && length >= 7) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      }
    }
    offset += length
  }
  throw statusError(400, "Input JPEG dimensions are missing")
}

function webpDimensions(bytes) {
  if (
    bytes.length < 30 ||
    bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
    bytes.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw statusError(400, "Input WebP header is invalid")
  }
  const format = bytes.subarray(12, 16).toString("ascii")
  if (format === "VP8X") {
    if ((bytes[20] & 0x02) !== 0) {
      throw statusError(400, "Animated WebP images are not allowed")
    }
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    }
  }
  if (format === "VP8L" && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height:
        1 +
        (bytes[22] >> 6) +
        (bytes[23] << 2) +
        ((bytes[24] & 0x0f) << 10),
    }
  }
  if (
    format === "VP8 " &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    }
  }
  throw statusError(400, "Input WebP dimensions are missing")
}

function statusError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

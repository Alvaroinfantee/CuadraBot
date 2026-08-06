const CONTROL_OR_AMBIGUOUS_ESCAPE =
  /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i

export function safeRelativePath(
  value: string | null | undefined,
  fallback = "/dashboard"
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    CONTROL_OR_AMBIGUOUS_ESCAPE.test(value)
  ) {
    return fallback
  }

  try {
    const base = new URL("https://cuadrabot.invalid")
    const parsed = new URL(value, base)
    if (
      parsed.origin !== base.origin ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//") ||
      parsed.username ||
      parsed.password
    ) {
      return fallback
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

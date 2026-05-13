import { NextResponse } from "next/server"

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const [scheme, token] = header.split(" ")

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null
  }

  return token
}

export function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120)
}

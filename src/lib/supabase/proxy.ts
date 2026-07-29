import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function getPublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export async function refreshSupabaseSession(
  request: NextRequest,
  additionalRequestHeaders?: HeadersInit
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = getPublicKey()

  if (!url || !key) {
    return responseWithRequestHeaders(request, additionalRequestHeaders)
  }

  let response = responseWithRequestHeaders(
    request,
    additionalRequestHeaders
  )
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = responseWithRequestHeaders(
          request,
          additionalRequestHeaders
        )
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  await supabase.auth.getClaims()

  return response
}

function responseWithRequestHeaders(
  request: NextRequest,
  additionalRequestHeaders?: HeadersInit
) {
  const headers = new Headers(request.headers)
  if (additionalRequestHeaders) {
    new Headers(additionalRequestHeaders).forEach((value, name) => {
      headers.set(name, value)
    })
  }
  return NextResponse.next({ request: { headers } })
}

import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createCustomerUploadSignedUrl } from "@/lib/orders"
import { fileSignSchema, validateUploadFile } from "@/lib/schemas"
import { jsonError, sanitizeFilename } from "@/lib/http"
import { isTakeoffOrderNotes } from "@/lib/takeoff-quote"

type Context = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const body = await request.json().catch(() => null)
  const parsed = fileSignSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid file metadata.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const supabase = createSupabaseAdminClient()
  const orderToken = request.headers.get("x-order-token")
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,public_token,order_number,status,customer_notes")
    .eq("id", id)
    .maybeSingle()

  if (orderError) {
    return jsonError(orderError.message, 500)
  }

  if (!order || order.public_token !== orderToken || order.status !== "draft") {
    return jsonError("Order is not available for uploads.", 403)
  }

  if (isTakeoffOrderNotes(order.customer_notes)) {
    const isPdf =
      parsed.data.mimeType === "application/pdf" ||
      parsed.data.filename.toLowerCase().endsWith(".pdf")

    if (!isPdf) {
      return jsonError("Takeoff orders only accept PDF blueprint files.", 400)
    }
  }

  const validationError = validateUploadFile(
    parsed.data.filename,
    parsed.data.mimeType,
    parsed.data.sizeBytes
  )

  if (validationError) {
    return jsonError(validationError, 400)
  }

  const filename = sanitizeFilename(parsed.data.filename)
  const signed = await createCustomerUploadSignedUrl({
    orderNumber: order.order_number,
    filename,
    mimeType: parsed.data.mimeType,
  })

  const { error: fileError } = await supabase.from("order_files").insert({
    order_id: order.id,
    bucket: signed.bucket,
    storage_path: signed.path,
    original_filename: parsed.data.filename,
    mime_type: parsed.data.mimeType,
    size_bytes: parsed.data.sizeBytes,
    file_role: "customer_upload",
  })

  if (fileError) {
    return jsonError(fileError.message, 500)
  }

  return NextResponse.json({
    bucket: signed.bucket,
    path: signed.path,
    signedUrl: signed.signedUrl,
    token: signed.token,
  })
}

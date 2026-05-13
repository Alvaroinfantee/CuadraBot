import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { blenderOutputBucket } from "@/lib/config"
import { jsonError, sanitizeFilename } from "@/lib/http"
import { requireWorker } from "@/lib/worker-auth"

type Context = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function POST(request: Request, context: Context) {
  const worker = requireWorker(request)

  if (!worker) {
    return jsonError("Unauthorized worker request.", 401)
  }

  const { id } = await context.params
  const supabase = createSupabaseAdminClient()
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number,assigned_worker_id")
    .eq("id", id)
    .maybeSingle()

  if (orderError) {
    return jsonError(orderError.message, 500)
  }

  if (!order || order.assigned_worker_id !== worker.workerId) {
    return jsonError("Worker has not claimed this job.", 403)
  }

  const formData = await request.formData()
  const uploadItems = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File)

  if (!uploadItems.length) {
    return jsonError("Attach at least one final render file.", 400)
  }

  const uploaded = []

  for (const file of uploadItems) {
    const filename = sanitizeFilename(file.name)
    const storagePath = `orders/${order.order_number}/final/${crypto.randomUUID()}-${filename}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from(blenderOutputBucket)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (uploadError) {
      return jsonError(uploadError.message, 500)
    }

    const { data: row, error: insertError } = await supabase
      .from("order_files")
      .insert({
        order_id: order.id,
        bucket: blenderOutputBucket,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        file_role: "final_render",
      })
      .select("*")
      .single()

    if (insertError) {
      return jsonError(insertError.message, 500)
    }

    uploaded.push(row)
  }

  return NextResponse.json({ files: uploaded })
}

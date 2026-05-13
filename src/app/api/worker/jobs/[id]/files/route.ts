import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { jsonError } from "@/lib/http"
import { requireWorker } from "@/lib/worker-auth"

type Context = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function GET(request: Request, context: Context) {
  const worker = requireWorker(request)

  if (!worker) {
    return jsonError("Unauthorized worker request.", 401)
  }

  const { id } = await context.params
  const supabase = createSupabaseAdminClient()
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,assigned_worker_id")
    .eq("id", id)
    .maybeSingle()

  if (orderError) {
    return jsonError(orderError.message, 500)
  }

  if (!order || order.assigned_worker_id !== worker.workerId) {
    return jsonError("Worker has not claimed this job.", 403)
  }

  const { data: files, error: fileError } = await supabase
    .from("order_files")
    .select("*")
    .eq("order_id", id)
    .eq("file_role", "customer_upload")
    .order("created_at", { ascending: true })

  if (fileError) {
    return jsonError(fileError.message, 500)
  }

  const signedFiles = await Promise.all(
    (files ?? []).map(async (file) => {
      const { data, error } = await supabase.storage
        .from(file.bucket)
        .createSignedUrl(file.storage_path, 60 * 60)

      if (error) {
        throw new Error(error.message)
      }

      return {
        id: file.id,
        filename: file.original_filename,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        signedUrl: data.signedUrl,
      }
    })
  )

  return NextResponse.json({ files: signedFiles })
}

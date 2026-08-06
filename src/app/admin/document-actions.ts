"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const archiveActions = new Set([
  "place_hold",
  "release_hold",
  "request_deletion",
  "cancel_deletion",
])
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function transitionDocumentArchive(formData: FormData) {
  const admin = await requireAdmin()
  const archiveId = String(formData.get("archiveId") ?? "")
  const action = String(formData.get("archiveAction") ?? "")
  const reason = String(formData.get("reason") ?? "").trim()

  if (!uuidPattern.test(archiveId)) {
    throw new Error("Document archive not found.")
  }
  if (!archiveActions.has(action)) {
    throw new Error("Choose a supported document action.")
  }
  if (reason.length < 5 || reason.length > 500) {
    throw new Error("Give a clear reason in 5 to 500 characters.")
  }
  if (!admin.email) {
    throw new Error("The administrator profile needs an email address.")
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc("admin_transition_document_archive", {
    p_archive_id: archiveId,
    p_actor_user_id: admin.id,
    p_actor_email: admin.email,
    p_action: action,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/admin/documents")
  revalidatePath(`/admin/documents/${archiveId}`)
  revalidatePath("/admin/audit")
  redirect(`/admin/documents/${archiveId}?updated=${action}`)
}

export async function finalizeDocumentArchiveDeletion(formData: FormData) {
  const admin = await requireAdmin()
  const archiveId = String(formData.get("archiveId") ?? "")
  const reason = String(formData.get("reason") ?? "").trim()
  const confirmation = String(formData.get("confirmation") ?? "").trim()

  if (!uuidPattern.test(archiveId)) {
    throw new Error("Document archive not found.")
  }
  if (reason.length < 5 || reason.length > 500) {
    throw new Error("Give a clear reason in 5 to 500 characters.")
  }
  if (confirmation !== "DELETE SOURCE") {
    throw new Error('Type "DELETE SOURCE" to confirm exact-path removal.')
  }
  if (!admin.email) {
    throw new Error("The administrator profile needs an email address.")
  }

  const supabase = createSupabaseAdminClient()
  const { data: archive, error: archiveError } = await supabase
    .from("document_archives")
    .select(
      "id,job_id,user_id,bucket,storage_path,status,legal_hold_at,deletion_requested_by"
    )
    .eq("id", archiveId)
    .maybeSingle()
  if (archiveError) throw new Error(archiveError.message)
  if (
    !archive ||
    !["deletion_requested", "deleting"].includes(archive.status)
  ) {
    throw new Error("A recorded deletion request is required.")
  }
  if (archive.legal_hold_at) {
    throw new Error("A legal hold blocks source-plan deletion.")
  }
  if (archive.deletion_requested_by === admin.id) {
    throw new Error(
      "A second active administrator must approve source-plan deletion."
    )
  }

  const expectedPrefix = `${archive.user_id}/${archive.job_id}/`
  if (
    archive.bucket !== "takeoff-uploads" ||
    !archive.storage_path.startsWith(expectedPrefix)
  ) {
    throw new Error("The archived source path failed a security check.")
  }

  const { data: claimData, error: claimError } = await supabase.rpc(
    "begin_document_archive_deletion",
    {
      p_archive_id: archive.id,
      p_actor_user_id: admin.id,
      p_actor_email: admin.email,
      p_reason: reason,
    }
  )
  const deletionToken = readDeletionToken(claimData)
  if (claimError || !deletionToken) {
    throw new Error(
      claimError?.message ?? "Could not claim the approved source deletion."
    )
  }

  const { error: removeError } = await supabase.storage
    .from(archive.bucket)
    .remove([archive.storage_path])

  const checkedAt = new Date().toISOString()
  const { data: stillPresent, error: presenceError } = await supabase.storage
    .from(archive.bucket)
    .exists(archive.storage_path)
  if (presenceError) {
    await recordDeletionFailureAlert(
      supabase,
      archive,
      `Storage removal could not be verified: ${presenceError.message}`
    )
    throw new Error(
      "The deletion lease remains active because object removal could not be verified. Investigate Storage or retry after 15 minutes."
    )
  }
  if (stillPresent) {
    const { error: releaseError } = await supabase.rpc(
      "release_document_archive_deletion",
      {
        p_archive_id: archive.id,
        p_actor_user_id: admin.id,
        p_actor_email: admin.email,
        p_deletion_token: deletionToken,
        p_reason: (
          `The source object remained present after Storage removal${removeError ? `: ${removeError.message}` : "."}`
        ).slice(0, 500),
      }
    )
    if (releaseError) {
      await recordDeletionFailureAlert(
        supabase,
        archive,
        `The source remained present and the deletion lease could not be released: ${releaseError.message}`
      )
    }
    throw new Error(
      releaseError
        ? "The source remains present and the deletion lease needs attention."
        : "The source remains present. The deletion request is ready to retry."
    )
  }

  const { error: finalizeError } = await supabase.rpc(
    "finalize_document_archive_deletion",
    {
      p_archive_id: archive.id,
      p_deletion_token: deletionToken,
      p_actor_user_id: admin.id,
      p_actor_email: admin.email,
      p_reason: reason,
      p_absence_verified_at: checkedAt,
    }
  )
  if (finalizeError) {
    await recordDeletionFailureAlert(
      supabase,
      archive,
      `The source is absent, but its tombstone could not be finalized: ${finalizeError.message}`
    )
    throw new Error(
      `The source is absent, but the archive tombstone needs attention: ${finalizeError.message}`
    )
  }

  await supabase
    .from("admin_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq("dedupe_key", `document-archive-tombstone:${archive.id}`)
    .in("status", ["open", "acknowledged"])

  revalidatePath("/admin/documents")
  revalidatePath(`/admin/documents/${archive.id}`)
  revalidatePath("/admin/audit")
  redirect(`/admin/documents/${archive.id}?updated=delete_source`)
}

function readDeletionToken(value: unknown) {
  const record = Array.isArray(value) ? value[0] : value
  if (!record || typeof record !== "object") return null
  const token = (record as Record<string, unknown>).deletion_token
  return typeof token === "string" ? token : null
}

async function recordDeletionFailureAlert(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  archive: {
    id: string
    job_id: string
    user_id: string
    bucket: string
    storage_path: string
  },
  error: string
) {
  await supabase.from("admin_alerts").insert({
    severity: "critical",
    category: "data",
    title: "Source deletion needs attention",
    message:
      "An approved source deletion could not complete safely. Customer access and lifecycle changes remain blocked by the deletion lease.",
    status: "open",
    dedupe_key: `document-archive-tombstone:${archive.id}`,
    entity_type: "document_archive",
    entity_id: archive.id,
    user_id: archive.user_id,
    job_id: archive.job_id,
    metadata: {
      bucket: archive.bucket,
      storage_path: archive.storage_path,
      error,
    },
  })
}

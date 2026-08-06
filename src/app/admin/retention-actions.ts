"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import {
  parseProjectFileRetentionDays,
  PROJECT_FILE_RETENTION_DESCRIPTION,
  PROJECT_FILE_RETENTION_SETTING_KEY,
} from "@/lib/project-file-retention"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function updateProjectFileRetention(formData: FormData) {
  const admin = await requireAdmin()
  const rawDays = String(formData.get("days") ?? "").trim()
  const reason = String(formData.get("reason") ?? "").trim()

  if (!/^\d+$/.test(rawDays)) {
    throw new Error("Retention must be a whole number of days.")
  }

  const parsed = parseProjectFileRetentionDays(Number(rawDays))
  if (!parsed.ok) throw new Error(parsed.error)
  if (reason.length < 5 || reason.length > 500) {
    throw new Error("Provide a reason between 5 and 500 characters.")
  }

  const supabase = createSupabaseAdminClient()
  const { data: before, error: beforeError } = await supabase
    .from("app_settings")
    .select("*")
    .eq("key", PROJECT_FILE_RETENTION_SETTING_KEY)
    .maybeSingle()
  if (beforeError) throw new Error(beforeError.message)

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: PROJECT_FILE_RETENTION_SETTING_KEY,
      value: parsed.days,
      description: PROJECT_FILE_RETENTION_DESCRIPTION,
      public_readable: true,
      updated_by: admin.id,
    },
    { onConflict: "key" }
  )
  if (error) throw new Error(error.message)

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_user_id: admin.id,
    actor_email: admin.email,
    action: "project_file_retention.updated",
    target_type: "app_setting",
    target_id: PROJECT_FILE_RETENTION_SETTING_KEY,
    reason,
    before_state: before,
    after_state: { value: parsed.days },
  })
  if (auditError) {
    throw new Error(
      `Retention changed but audit logging failed: ${auditError.message}`
    )
  }

  revalidatePath("/admin/settings")
  revalidatePath("/admin/audit")
  revalidatePath("/admin/health")
}

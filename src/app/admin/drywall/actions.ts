"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const transitions: Record<string, string[]> = {
  order_received: ["initial_review"],
  initial_review: ["takeoff_in_progress"],
  takeoff_in_progress: ["quality_review"],
  quality_review: ["takeoff_in_progress"],
  delivered: ["completed"],
  revised: ["completed"],
  revision_requested: ["takeoff_in_progress"],
}

export async function transitionDrywallProject(formData: FormData) {
  const admin = await requireAdmin()
  const projectId = String(formData.get("projectId") ?? "")
  const nextStatus = String(formData.get("nextStatus") ?? "")
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) throw new Error("Project not found.")
  const supabase = createSupabaseAdminClient()
  const { data: project } = await supabase.from("drywall_takeoff_projects").select("status").eq("id", projectId).maybeSingle()
  if (!project || !transitions[project.status]?.includes(nextStatus)) throw new Error("That project transition is not allowed.")
  const { error } = await supabase.from("drywall_takeoff_projects").update({ status: nextStatus }).eq("id", projectId).eq("status", project.status)
  if (error) throw new Error(error.message)
  await supabase.from("drywall_takeoff_events").insert({ project_id: projectId, event_name: "status_changed", actor: admin.email ?? admin.id, metadata: { from: project.status, to: nextStatus } })
  revalidatePath("/admin/drywall")
  revalidatePath(`/admin/drywall/${projectId}`)
}

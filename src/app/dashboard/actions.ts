"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

function field(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

export async function updateCompanyProfile(formData: FormData) {
  const user = await requireUser("/dashboard/settings")
  const fullName = field(formData, "fullName")
  const companyName = field(formData, "companyName")
  const countryCode = field(formData, "countryCode").toUpperCase()
  const region = field(formData, "region")
  const city = field(formData, "city")
  const timezone = field(formData, "timezone")

  if (fullName.length < 2 || companyName.length < 2) {
    throw new Error("Name and company are required.")
  }
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("Use a two-letter country code.")
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      company_name: companyName,
      country_code: countryCode || null,
      region: region || null,
      city: city || null,
      timezone: timezone || null,
      location_source: "user",
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", user.id)
  if (error) throw new Error(error.message)

  await supabase.from("analytics_events").insert({
    user_id: user.id,
    event_name: "company_profile_updated",
    source: "product",
    metadata: { location_updated: Boolean(countryCode) },
  })
  revalidatePath("/dashboard", "layout")
  revalidatePath("/dashboard/settings")
  redirect("/dashboard/settings?saved=1")
}

export async function requestCorrection(formData: FormData) {
  const jobId = field(formData, "jobId")
  const message = field(formData, "message")
  const user = await requireUser(`/dashboard/jobs/${jobId}/correction`)
  if (!jobId || message.length < 10 || message.length > 4_000) {
    throw new Error("Describe the correction in 10 to 4,000 characters.")
  }

  const supabase = createSupabaseAdminClient()
  const { data: correctedJob, error } = await supabase.rpc(
    "request_takeoff_correction",
    {
      p_job_id: jobId,
      p_user_id: user.id,
      p_message: message,
    }
  )
  if (error || !correctedJob) {
    const errorMessage =
      error?.message ?? "The correction request could not be saved."
    if (errorMessage.includes("active retention operation")) {
      throw new Error(
        "The project files are being archived. Refresh and try again shortly."
      )
    }
    throw new Error(errorMessage)
  }

  revalidatePath(`/dashboard/jobs/${jobId}`)
  revalidatePath("/admin/jobs")
  redirect(`/dashboard/jobs/${jobId}?correction=requested`)
}

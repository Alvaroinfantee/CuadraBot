import { AdminShell } from "@/components/admin/admin-shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updatePackageAction } from "@/lib/admin-actions"
import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const metadata = {
  title: "Admin packages",
}

export const dynamic = "force-dynamic"

export default async function AdminPackagesPage() {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()
  const { data: packages, error } = await supabase
    .from("packages")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (
    <AdminShell title="Packages">
      <div className="grid gap-6 lg:grid-cols-3">
        {(packages ?? []).map((plan) => (
          <form key={plan.id} action={updatePackageAction} className="flex flex-col gap-4 border p-5">
            <input type="hidden" name="package_id" value={plan.id} />
            <FieldGroup>
              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input name="name" defaultValue={plan.name} />
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <Textarea name="description" defaultValue={plan.description} rows={4} />
              </Field>
              <Field>
                <FieldLabel>Price cents</FieldLabel>
                <Input name="price_cents" type="number" defaultValue={plan.price_cents} />
              </Field>
              <Field>
                <FieldLabel>Currency</FieldLabel>
                <Input name="currency" defaultValue={plan.currency} />
              </Field>
              <Field>
                <FieldLabel>Stripe Price ID</FieldLabel>
                <Input name="stripe_price_id" defaultValue={plan.stripe_price_id ?? ""} />
              </Field>
              <Field>
                <FieldLabel>Sort order</FieldLabel>
                <Input name="sort_order" type="number" defaultValue={plan.sort_order} />
              </Field>
              <Field orientation="horizontal">
                <Checkbox name="active" defaultChecked={plan.active} />
                <FieldLabel>Active</FieldLabel>
              </Field>
            </FieldGroup>
            <Button type="submit">Save package</Button>
          </form>
        ))}
      </div>
    </AdminShell>
  )
}

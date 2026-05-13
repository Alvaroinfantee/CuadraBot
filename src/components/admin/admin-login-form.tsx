"use client"

import { useActionState } from "react"
import { Loader2Icon } from "lucide-react"
import { loginAdmin, type LoginState } from "@/lib/admin-actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: LoginState = {}

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, initialState)

  return (
    <form action={action} className="flex flex-col gap-5 border p-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
      </FieldGroup>
      {state.error ? <FieldError errors={[{ message: state.error }]} /> : null}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
        Log in
      </Button>
    </form>
  )
}

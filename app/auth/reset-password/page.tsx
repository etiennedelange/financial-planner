"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { createClient } from "@/lib/supabase/client"
import { listFactors } from "@/lib/auth/mfa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"
import { TotpReauthDialog } from "@/components/auth/totp-reauth-dialog"

const schema = z
  .object({
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a digit"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  })

type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [pending, setPending] = useState<Form | null>(null)
  const form = useForm<Form>({ resolver: zodResolver(schema) })

  // The recovery link must have established a session before we get here.
  // Landing without one means the link was stale, reused, or tampered with.
  useEffect(() => {
    createClient().auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        // `/calculator` itself server-redirects to `/calculator/overview` and drops
        // the query string in the process — target the final route directly so the
        // error marker survives.
        router.replace("/calculator/overview?error=reset-expired")
        return
      }
      // A recovery link yields an aal1 session, and GoTrue refuses a password
      // change from aal1 once the account has a verified factor
      // (401 insufficient_aal). This route is exempt from the middleware AAL
      // gate — it has to be reachable by someone who has lost their password —
      // so the second-factor challenge has to happen here instead.
      try {
        setFactorId((await listFactors())[0]?.id ?? null)
      } catch {
        setError("Could not check your two-factor settings. Try the reset link again.")
      }
      setChecking(false)
    })
  }, [router])

  async function applyNewPassword(password: string) {
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      return
    }
    // Kill every other session — a password reset usually means the old one was
    // compromised, and leaving those sessions alive defeats the point.
    await supabase.auth.signOut({ scope: "others" })
    router.replace("/calculator/overview?reset=success")
  }

  async function onSubmit(values: Form) {
    setError(null)
    if (factorId) {
      setPending(values)
      return
    }
    await applyNewPassword(values.password)
  }

  if (checking) return null

  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center px-4">
      <PageCard label="Set a New Password" contentClassName="space-y-4" className="w-full">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-pw" className="text-xs font-medium">New password</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" autoFocus
              className={`h-8 text-sm ${form.formState.errors.password ? "border-destructive" : ""}`}
              {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-pw" className="text-xs font-medium">Confirm password</Label>
            <Input id="confirm-pw" type="password" autoComplete="new-password"
              className={`h-8 text-sm ${form.formState.errors.confirm ? "border-destructive" : ""}`}
              {...form.register("confirm")} />
            {form.formState.errors.confirm && (
              <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
            )}
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Updating…" : "Update Password"}
          </Button>
        </form>

        {factorId && (
          <TotpReauthDialog
            open={pending !== null}
            factorId={factorId}
            action="change your password"
            onCancel={() => setPending(null)}
            onConfirmed={() => {
              const values = pending
              setPending(null)
              if (values) void applyNewPassword(values.password)
            }}
          />
        )}
      </PageCard>
    </div>
  )
}

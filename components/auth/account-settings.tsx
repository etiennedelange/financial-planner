"use client"

import { createClient } from "@/lib/supabase/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ReauthenticateDialog } from "@/components/auth/reauthenticate-dialog"
import { SecuritySection } from "@/components/auth/security-section"
import { SessionList } from "@/components/auth/session-list"
import { PageCard } from "@/components/ui/page-card"
import { Download } from "lucide-react"
import type { User } from "@supabase/supabase-js"

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
})

const passwordSchema = z
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
    message: "Passwords don't match",
    path: ["confirm"],
  })

type EmailForm = z.infer<typeof emailSchema>
type PasswordForm = z.infer<typeof passwordSchema>

interface AccountSettingsProps {
  user: User
}

export function AccountSettings({ user }: AccountSettingsProps) {
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })
  const pwForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const [pendingAction, setPendingAction] = useState<
    | { kind: "email"; values: EmailForm }
    | { kind: "password"; values: PasswordForm }
    | { kind: "delete" }
    | null
  >(null)

  async function runEmailChange(values: EmailForm) {
    setEmailLoading(true); setEmailMsg(null)
    const { error } = await createClient().auth.updateUser({ email: values.email })
    setEmailLoading(false)
    if (error) setEmailMsg({ type: "error", text: error.message })
    else {
      setEmailMsg({ type: "success", text: "Check both inboxes to confirm the change." })
      emailForm.reset()
    }
  }

  async function runPasswordChange(values: PasswordForm) {
    setPwLoading(true); setPwMsg(null)
    const { error } = await createClient().auth.updateUser({ password: values.password })
    setPwLoading(false)
    if (error) setPwMsg({ type: "error", text: error.message })
    else {
      setPwMsg({ type: "success", text: "Password updated successfully." })
      pwForm.reset()
    }
  }

  async function runDelete() {
    const res = await fetch("/api/account/delete", { method: "DELETE" })
    if (!res.ok) {
      const { error } = await res.json()
      setDeleteMsg(error ?? "Could not delete the account.")
      return
    }
    localStorage.clear()
    window.location.href = "/calculator"
  }

  return (
    <>
      <PageCard label="Account" contentClassName="space-y-6">
        <p className="text-sm text-muted-foreground -mt-1">{user.email}</p>

        <form onSubmit={emailForm.handleSubmit((values) => setPendingAction({ kind: "email", values }))}
          className="space-y-3 max-w-sm">
          <Field label="New email" id="acct-email" type="email" autoComplete="email"
            placeholder={user.email}
            error={emailForm.formState.errors.email?.message}
            {...emailForm.register("email")} />
          <StatusMessage message={emailMsg} />
          <Button type="submit" variant="outline" size="sm" disabled={emailLoading}>
            {emailLoading ? "Sending confirmation…" : "Update Email"}
          </Button>
        </form>

        <div className="border-t" />

        <form onSubmit={pwForm.handleSubmit((values) => setPendingAction({ kind: "password", values }))}
          className="space-y-3 max-w-sm">
          <Field label="New password" id="acct-pw" type="password" autoComplete="new-password"
            error={pwForm.formState.errors.password?.message}
            {...pwForm.register("password")} />
          <Field label="Confirm password" id="acct-pw2" type="password" autoComplete="new-password"
            error={pwForm.formState.errors.confirm?.message}
            {...pwForm.register("confirm")} />
          <StatusMessage message={pwMsg} />
          <Button type="submit" variant="outline" size="sm" disabled={pwLoading}>
            {pwLoading ? "Updating…" : "Update Password"}
          </Button>
        </form>

        <div className="border-t" />

        <Button variant="outline" size="sm" asChild>
          <a href="/api/account/export" download>
            <Download className="mr-2 h-4 w-4" />
            Export My Data
          </a>
        </Button>
      </PageCard>

      <SecuritySection email={user.email ?? ""} />

      <PageCard label="Active Sessions" contentClassName="space-y-3">
        <SessionList />
      </PageCard>

      <PageCard label="Delete Account" labelVariant="destructive"
        className="border-destructive/40" contentClassName="space-y-3">
        <p className="text-sm text-muted-foreground max-w-prose">
          Deleting your account removes every scenario, account and expense permanently.
          This cannot be undone — export your data first if you want a copy.
        </p>
        {deleteMsg && <p className="text-sm text-destructive">{deleteMsg}</p>}
        <Button variant="destructive" size="sm"
          onClick={() => setPendingAction({ kind: "delete" })}>
          Delete My Account
        </Button>
      </PageCard>

      <ReauthenticateDialog
        open={pendingAction !== null}
        email={user.email ?? ""}
        action={
          pendingAction?.kind === "email"
            ? "change your email address"
            : pendingAction?.kind === "delete"
              ? "delete your account permanently"
              : "change your password"
        }
        onCancel={() => setPendingAction(null)}
        onConfirmed={() => {
          const action = pendingAction
          setPendingAction(null)
          if (action?.kind === "email") void runEmailChange(action.values)
          if (action?.kind === "password") void runPasswordChange(action.values)
          if (action?.kind === "delete") void runDelete()
        }}
      />
    </>
  )
}

function Field({ label, id, error, ...props }: { label: string; id: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <Input id={id} className={error ? "border-destructive" : ""} {...props} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function StatusMessage({ message }: { message: { type: "success" | "error"; text: string } | null }) {
  if (!message) return null
  return (
    <p className={`text-sm rounded-md px-3 py-2 ${
      message.type === "error"
        ? "bg-destructive/10 text-destructive"
        : "bg-green-500/10 text-green-700 dark:text-green-400"
    }`}>
      {message.text}
    </p>
  )
}

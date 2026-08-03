"use client"

import { createClient } from "@/lib/supabase/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StaticFinanceChart } from "@/components/auth/static-finance-chart"
import { ReauthenticateDialog } from "@/components/auth/reauthenticate-dialog"
import { SecuritySection } from "@/components/auth/security-section"
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

interface ProfileModalProps {
  open: boolean
  onClose: () => void
  user: User
}

export function ProfileModal({ open, onClose, user }: ProfileModalProps) {
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })
  const pwForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const [pendingAction, setPendingAction] = useState<
    { kind: "email"; values: EmailForm } | { kind: "password"; values: PasswordForm } | null
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

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
          {/* Header */}
          <div className="bg-primary/8 border-b px-6 py-6 flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center">
              <StaticFinanceChart width={64} height={52} />
            </div>
            <div className="text-center">
              <DialogTitle className="text-base font-semibold">Manage Account</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{user.email}</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Change email */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium">Change Email</h3>
              <form onSubmit={emailForm.handleSubmit((values) => setPendingAction({ kind: "email", values }))} className="space-y-3">
                <Field label="New email" id="prof-email" type="email" autoComplete="email"
                  placeholder={user.email}
                  error={emailForm.formState.errors.email?.message}
                  {...emailForm.register("email")} />
                <StatusMessage message={emailMsg} />
                <Button type="submit" variant="outline" className="w-full" disabled={emailLoading}>
                  {emailLoading ? "Sending confirmation…" : "Update Email"}
                </Button>
              </form>
            </section>

            <div className="border-t" />

            {/* Change password */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium">Change Password</h3>
              <form onSubmit={pwForm.handleSubmit((values) => setPendingAction({ kind: "password", values }))} className="space-y-3">
                <Field label="New password" id="prof-pw" type="password" autoComplete="new-password"
                  error={pwForm.formState.errors.password?.message}
                  {...pwForm.register("password")} />
                <Field label="Confirm password" id="prof-pw2" type="password" autoComplete="new-password"
                  error={pwForm.formState.errors.confirm?.message}
                  {...pwForm.register("confirm")} />
                <StatusMessage message={pwMsg} />
                <Button type="submit" variant="outline" className="w-full" disabled={pwLoading}>
                  {pwLoading ? "Updating…" : "Update Password"}
                </Button>
              </form>
            </section>

            <div className="border-t" />

            <SecuritySection email={user.email ?? ""} />
          </div>

          <div className="border-t bg-muted/30 px-6 py-3 text-center text-xs text-muted-foreground">
            Changes to email require confirmation via the link sent to your new address.
          </div>
        </DialogContent>
      </Dialog>

      <ReauthenticateDialog
        open={pendingAction !== null}
        email={user.email ?? ""}
        action={pendingAction?.kind === "email" ? "change your email address" : "change your password"}
        onCancel={() => setPendingAction(null)}
        onConfirmed={() => {
          const action = pendingAction
          setPendingAction(null)
          if (action?.kind === "email") void runEmailChange(action.values)
          if (action?.kind === "password") void runPasswordChange(action.values)
        }}
      />
    </>
  )
}

function Field({ label, id, error, ...props }: { label: string; id: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      <Input id={id} className={`h-8 text-sm ${error ? "border-destructive" : ""}`} {...props} />
      {error && <p className="text-xs text-destructive">{error}</p>}
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

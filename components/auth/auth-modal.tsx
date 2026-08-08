"use client"

import { createClient } from "@/lib/supabase/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
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
import { FinanceAnimation } from "@/components/auth/finance-animation"
import { Turnstile, type TurnstileHandle } from "@/components/auth/turnstile"

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a digit")

const emailPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: passwordSchema,
})

// Sign-in must NOT apply the new complexity rules — existing users may hold a
// shorter legacy password and must still be able to sign in to change it.
const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
})

type Mode = "signin" | "signup" | "reset"
type EmailPasswordForm = z.infer<typeof emailPasswordSchema>
type SignInForm = z.infer<typeof signInSchema>
type EmailForm = z.infer<typeof emailSchema>

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

const modeConfig = {
  signin:  { title: "Welcome back",         subtitle: "Sign in to your account to continue" },
  signup:  { title: "Create an account",    subtitle: "Your existing data will be carried over" },
  reset:   { title: "Reset your password",  subtitle: "We'll send a reset link to your email" },
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("signin")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | undefined>()
  const turnstile = useRef<TurnstileHandle>(null)

  // Turnstile tokens are single-use. Every failed attempt has consumed the one
  // we hold, so it must be dropped and a fresh challenge issued — otherwise the
  // retry fails on a replayed captcha rather than on whatever the user fixed.
  function resetCaptcha() {
    setCaptchaToken(undefined)
    turnstile.current?.reset()
  }

  const signinForm  = useForm<SignInForm>({ resolver: zodResolver(signInSchema) })
  const signupForm  = useForm<EmailPasswordForm>({ resolver: zodResolver(emailPasswordSchema) })
  const resetForm   = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })

  function switchMode(next: Mode) {
    setMode(next)
    setMessage(null)
    resetCaptcha()
  }

  async function handleSignIn(values: SignInForm) {
    setLoading(true); setMessage(null)
    const { error } = await createClient().auth.signInWithPassword({
      email: values.email, password: values.password, options: { captchaToken },
    })
    setLoading(false)
    if (error) {
      setMessage({ type: "error", text: error.message })
      resetCaptcha()
    } else {
      onClose()
      // The AAL gate that sends a not-yet-second-factored session to /auth/mfa
      // lives in middleware, which only runs on a request — sign-in itself is
      // a client-side Supabase call with no navigation, so without this the
      // gate would sit dormant until some unrelated link click. refresh()
      // re-requests the current route, giving middleware a request to redirect.
      router.refresh()
    }
  }

  async function handleSignUp(values: EmailPasswordForm) {
    setLoading(true); setMessage(null)
    const { error } = await createClient().auth.signUp({
      email: values.email,
      password: values.password,
      options: { captchaToken, emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setMessage({ type: "error", text: error.message })
      resetCaptcha()
    } else {
      setMessage({ type: "success", text: "Check your email to confirm your account." })
    }
  }

  async function handleReset(values: EmailForm) {
    setLoading(true); setMessage(null)
    const { error } = await createClient().auth.resetPasswordForEmail(values.email, {
      captchaToken,
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setLoading(false)
    if (error) {
      setMessage({ type: "error", text: error.message })
      resetCaptcha()
    } else {
      setMessage({ type: "success", text: "Reset link sent — check your inbox." })
    }
  }

  const { title, subtitle } = modeConfig[mode]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
        {/* Header band */}
        <div className="bg-primary/8 border-b px-6 py-6 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center">
            <FinanceAnimation />
          </div>
          <div className="text-center">
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Form body */}
        <div className="px-6 py-5 space-y-4">
          {mode === "signin" && (
            <form onSubmit={signinForm.handleSubmit(handleSignIn)} className="space-y-3">
              <Field label="Email" id="si-email" type="email" autoComplete="email"
                error={signinForm.formState.errors.email?.message}
                {...signinForm.register("email")} />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="si-pw" className="text-xs font-medium">Password</Label>
                  <button type="button" onClick={() => switchMode("reset")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Forgot password?
                  </button>
                </div>
                <Input id="si-pw" type="password" autoComplete="current-password"
                  className={`h-8 text-sm ${signinForm.formState.errors.password ? "border-destructive" : ""}`}
                  {...signinForm.register("password")} />
                {signinForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{signinForm.formState.errors.password.message}</p>
                )}
              </div>
              <StatusMessage message={message} />
              <Turnstile ref={turnstile} onToken={setCaptchaToken} />
              <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
                {loading ? "Signing in…" : captchaToken ? "Sign In" : "Verifying…"}
              </Button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={signupForm.handleSubmit(handleSignUp)} className="space-y-3">
              <Field label="Email" id="su-email" type="email" autoComplete="email"
                error={signupForm.formState.errors.email?.message}
                {...signupForm.register("email")} />
              <Field label="Password" id="su-pw" type="password" autoComplete="new-password"
                error={signupForm.formState.errors.password?.message}
                {...signupForm.register("password")} />
              <StatusMessage message={message} />
              <Turnstile ref={turnstile} onToken={setCaptchaToken} />
              <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
                {loading ? "Creating account…" : captchaToken ? "Create Account" : "Verifying…"}
              </Button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={resetForm.handleSubmit(handleReset)} className="space-y-3">
              <Field label="Email" id="re-email" type="email" autoComplete="email"
                error={resetForm.formState.errors.email?.message}
                {...resetForm.register("email")} />
              <StatusMessage message={message} />
              <Turnstile ref={turnstile} onToken={setCaptchaToken} />
              <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
                {loading ? "Sending…" : captchaToken ? "Send Reset Link" : "Verifying…"}
              </Button>
            </form>
          )}
        </div>

        {/* Footer links */}
        <div className="border-t bg-muted/30 px-6 py-3 text-center text-xs text-muted-foreground">
          {mode === "signin" && (
            <>Don&apos;t have an account?{" "}
              <button onClick={() => switchMode("signup")} className="font-medium text-foreground hover:underline">Sign up</button>
            </>
          )}
          {mode === "signup" && (
            <>Already have an account?{" "}
              <button onClick={() => switchMode("signin")} className="font-medium text-foreground hover:underline">Sign in</button>
            </>
          )}
          {mode === "reset" && (
            <>Remembered it?{" "}
              <button onClick={() => switchMode("signin")} className="font-medium text-foreground hover:underline">Back to sign in</button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
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

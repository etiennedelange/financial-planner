"use client"

import { AuthModal } from "@/components/auth/auth-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isAuthEnabled } from "@/lib/config/features"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { LogIn, LogOut, Settings, User as UserIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

/**
 * Top-bar account control: a single icon button whose dropdown holds Settings
 * plus Sign in (anonymous) or the account email and Sign out (signed in).
 * While auth is feature-flagged off, Sign in is shown but disabled with a "Soon" tag.
 */
export function AccountMenu({ user }: { user: User | null }) {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const authEnabled = isAuthEnabled()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Account menu"
            className="relative h-8 w-8 px-0 text-muted-foreground hover:text-foreground"
          >
            <UserIcon className="h-4 w-4" />
            {user && (
              <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {user && (
            <>
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/calculator/settings">
              <Settings className="mr-2 h-4 w-4" />
              {user ? "Manage Account" : "Settings"}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user ? (
            <DropdownMenuItem
              onClick={() => createClient().auth.signOut()}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={!authEnabled}
              onClick={() => setAuthModalOpen(true)}
              className="cursor-pointer"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
              {!authEnabled && (
                <Badge variant="outline" className="ml-auto h-4 px-1.5 font-mono text-[9px] font-normal uppercase tracking-wider">
                  Soon
                </Badge>
              )}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}

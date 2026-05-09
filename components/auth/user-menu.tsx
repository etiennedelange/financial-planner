"use client"

import { AuthModal } from "@/components/auth/auth-modal"
import { ProfileModal } from "@/components/auth/profile-modal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient, SUPABASE_ENABLED } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { LogIn, LogOut, Settings, User as UserIcon } from "lucide-react"
import { useState } from "react"

interface UserMenuProps {
  user: User | null
}

export function UserMenu({ user }: UserMenuProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const isAnon = !user || user.is_anonymous
  const email = user?.email

  async function handleSignOut() {
    if (!SUPABASE_ENABLED) return
    const supabase = createClient()!
    await supabase.auth.signOut()
  }

  if (isAnon) {
    return (
      <>
        <Button variant="outline" size="icon" className="md:w-auto md:px-4" onClick={() => setModalOpen(true)}>
          <LogIn className="h-4 w-4" />
          <span className="ml-2 hidden md:inline">Sign In</span>
        </Button>
        <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="md:w-auto md:px-4">
            <UserIcon className="h-4 w-4" />
            <span className="ml-2 hidden md:inline max-w-32 truncate">{email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileOpen(true)} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Manage Account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} user={user} />
    </>
  )
}

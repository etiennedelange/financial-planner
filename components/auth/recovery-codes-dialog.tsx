"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

interface RecoveryCodesDialogProps {
  open: boolean
  codes: string[]
  onClose: () => void
}

/**
 * Shows recovery codes exactly once — only hashes are stored, so there is no
 * second chance. Closing is gated on an explicit acknowledgement.
 */
export function RecoveryCodesDialog({ open, codes, onClose }: RecoveryCodesDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  function handleDownload() {
    const blob = new Blob(
      [`Retirement Calculator recovery codes\n\nEach code works once.\n\n${codes.join("\n")}\n`],
      { type: "text/plain" },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "retirement-calculator-recovery-codes.txt"
    a.click()
    URL.revokeObjectURL(url)
    setAcknowledged(true)
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="text-base font-semibold">Save your recovery codes</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          These are shown once and never again. Each works a single time. Without them, a lost
          authenticator means losing access to your account.
        </DialogDescription>

        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 font-mono text-sm">
          {codes.map((code) => <span key={code}>{code}</span>)}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>Download</Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { void navigator.clipboard.writeText(codes.join("\n")); setAcknowledged(true) }}
          >
            Copy
          </Button>
        </div>

        <Button className="w-full" disabled={!acknowledged} onClick={onClose}>
          {acknowledged ? "I've saved them" : "Download or copy them first"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

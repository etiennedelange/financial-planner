"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { toast } from "@/lib/hooks/use-toast"
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"

export function ScenarioSwitcher() {
  const { scenarioList, activeScenarioId, switchScenario, createNewScenario, renameScenario, deleteScenario } =
    useCalculatorStore(
      useShallow((s) => ({
        scenarioList: s.scenarioList,
        activeScenarioId: s.activeScenarioId,
        switchScenario: s.switchScenario,
        createNewScenario: s.createNewScenario,
        renameScenario: s.renameScenario,
        deleteScenario: s.deleteScenario,
      }))
    )

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [loading, setLoading] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  if (scenarioList.length === 0) return null

  const active = scenarioList.find((s) => s.id === activeScenarioId)

  function startRename(id: string, currentName: string) {
    setRenamingId(id)
    setRenameValue(currentName)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== scenarioList.find((s) => s.id === id)?.name) {
      await renameScenario(id, trimmed)
      toast({ title: `Scenario renamed to "${trimmed}"` })
    }
    setRenamingId(null)
  }

  async function handleSwitch(id: string) {
    if (id === activeScenarioId || loading) return
    setLoading(true)
    await switchScenario(id)
    setLoading(false)
  }

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setLoading(true)
    await createNewScenario(trimmed)
    setNewName("")
    setCreatingNew(false)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (scenarioList.length <= 1) return
    setLoading(true)
    await deleteScenario(id)
    setLoading(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-44 px-3" disabled={loading}>
          <span className="truncate text-sm font-medium">{active?.name ?? "Scenarios"}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Scenarios</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {scenarioList.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-1 rounded-sm px-1 py-0.5 ${
              s.id === activeScenarioId ? "bg-accent" : ""
            }`}
          >
            {renamingId === s.id ? (
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(s.id)
                  if (e.key === "Escape") setRenamingId(null)
                }}
                className="h-7 text-sm"
                aria-label={`Rename scenario ${s.name}`}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <button
                  className="flex-1 truncate py-1.5 text-left text-sm"
                  onClick={() => handleSwitch(s.id)}
                >
                  {s.name}
                </button>
                <button
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); startRename(s.id, s.name) }}
                  title="Rename"
                  aria-label={`Rename scenario ${s.name}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {scenarioList.length > 1 && (
                  <button
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteId(s.id) }}
                    title="Delete"
                    aria-label={`Delete scenario ${s.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        <DropdownMenuSeparator />

        {creatingNew ? (
          <div className="flex gap-1 px-1 py-1">
            <Input
              autoFocus
              placeholder="Scenario name"
              aria-label="New scenario name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
                if (e.key === "Escape") { setCreatingNew(false); setNewName("") }
              }}
              className="h-7 text-sm"
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreate} disabled={!newName.trim()}>
              Add
            </Button>
          </div>
        ) : (
          <DropdownMenuItem
            className="cursor-pointer text-muted-foreground"
            onClick={(e) => { e.preventDefault(); setCreatingNew(true) }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Scenario
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {scenarioList.find((s) => s.id === pendingDeleteId)?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this scenario and all its settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await handleDelete(pendingDeleteId!)
                setPendingDeleteId(null)
                toast({ title: "Scenario deleted" })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DropdownMenu>
  )
}

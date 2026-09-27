import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/** POPIA data portability: everything the account holds, as JSON. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const [scenarios, expenseGroups, expenses] = await Promise.all([
    supabase.from("scenarios").select("*").eq("session_id", user.id),
    supabase.from("expense_groups").select("*").eq("session_id", user.id),
    supabase.from("expenses").select("*").eq("session_id", user.id),
  ])

  if (scenarios.error || expenseGroups.error || expenses.error) {
    return NextResponse.json({ error: "Could not load account data" }, { status: 500 })
  }

  const scenarioIds = (scenarios.data ?? []).map((s) => s.id)
  const accounts = scenarioIds.length
    ? await supabase.from("accounts").select("*").in("scenario_id", scenarioIds)
    : { data: [], error: null }

  if (accounts.error) {
    return NextResponse.json({ error: "Could not load account data" }, { status: 500 })
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    scenarios: scenarios.data ?? [],
    accounts: accounts.data ?? [],
    expenseGroups: expenseGroups.data ?? [],
    expenses: expenses.data ?? [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="financial-planner-export-${Date.now()}.json"`,
    },
  })
}

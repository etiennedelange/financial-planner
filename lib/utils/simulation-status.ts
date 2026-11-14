/**
 * The caption under the Risk page's success rate while there is no figure to show.
 *
 * A worker failure must read as a failure: it used to fall through to "Waiting for
 * simulation", so a worker that never loaded looked like a run that was merely slow.
 */
export function noRangeCaption(isSimulating: boolean, hasError: boolean): string {
  if (isSimulating) return "Simulating…"
  if (hasError) return "Simulation failed to run. Reload the page to try again."
  return "Waiting for simulation"
}

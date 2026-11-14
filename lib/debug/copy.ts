/**
 * Clipboard write with an outcome the UI can announce.
 *
 * The old debug dialog swallowed a clipboard failure into console.error, so a blocked
 * clipboard (insecure context, denied permission, no focus) looked like nothing happened.
 */
export type CopyOutcome = "copied" | "failed"

export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.clipboard,
): Promise<CopyOutcome> {
  if (!clipboard) return "failed"
  try {
    await clipboard.writeText(text)
    return "copied"
  } catch {
    return "failed"
  }
}

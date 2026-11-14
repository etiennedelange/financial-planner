/** Types into a controlled React input the way a user would (fires React's onChange). */
export function setInputValue(input: HTMLInputElement, value: string): void {
  // The prototype setter bypasses React's per-instance value tracker, so onChange fires.
  // oxlint-disable-next-line typescript/unbound-method
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!
  Reflect.apply(descriptor.set as (v: string) => void, input, [value])
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

export function pressKey(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
}

/** Sets a controlled React input's value the way a user typing would (fires React's onChange). */
export function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!
  // The prototype setter bypasses React's per-instance value tracker, so onChange fires.
  // oxlint-disable-next-line typescript/unbound-method
  Reflect.apply(descriptor.set as (v: string) => void, input, [value])
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

/** Fires a form's submit event (what pressing Enter / the submit button does after native validation passes). */
export function submitForm(form: HTMLFormElement): void {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
}

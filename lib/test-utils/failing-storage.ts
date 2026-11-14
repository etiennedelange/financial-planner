/**
 * Test helper: swaps `window.localStorage` for a stub that delegates to the real
 * storage but throws from `setItem` (all keys, or those matching `shouldFail`).
 * Spying on Storage.prototype is unreliable under happy-dom (the first call caches
 * the method on the instance), so the whole object is replaced. Returns a restore fn.
 */
export function installFailingSetItem(
  error: unknown,
  shouldFail: (key: string) => boolean = () => true,
): () => void {
  const real = window.localStorage
  const stub: Storage = {
    get length() {
      return real.length
    },
    key: (index) => real.key(index),
    getItem: (key) => real.getItem(key),
    removeItem: (key) => real.removeItem(key),
    clear: () => real.clear(),
    setItem: (key, value) => {
      if (shouldFail(key)) throw error
      real.setItem(key, value)
    },
  }
  Object.defineProperty(window, "localStorage", { value: stub, configurable: true })
  return () => Object.defineProperty(window, "localStorage", { value: real, configurable: true })
}

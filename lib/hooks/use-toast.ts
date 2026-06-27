import * as React from "react"

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 4200

type ToastProps = {
  id: string
  title?: string
  description?: string
  duration?: number
}

type ToastState = {
  toasts: ToastProps[]
}

type Action =
  | { type: "ADD_TOAST"; toast: ToastProps }
  | { type: "REMOVE_TOAST"; toastId: string }

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case "REMOVE_TOAST":
      return { toasts: state.toasts.filter((t) => t.id !== action.toastId) }
  }
}

function toast(props: Omit<ToastProps, "id">) {
  const id = genId()
  dispatch({ type: "ADD_TOAST", toast: { id, ...props } })
  toastTimeouts.set(
    id,
    setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", toastId: id })
      toastTimeouts.delete(id)
    }, props.duration ?? TOAST_REMOVE_DELAY)
  )
}

function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)
  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])
  return { toasts: state.toasts, toast }
}

export { useToast, toast }

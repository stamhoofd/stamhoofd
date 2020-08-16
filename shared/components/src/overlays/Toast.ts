export type ToastListener = (toast: Toast) => void

export class Toast {
    protected static listeners: Map<any, ToastListener> = new Map()
    message: string
    icon: string | null
    withOffset = false

    autohideAfter = 5000

    constructor(message: string, icon: string | null = null) {
        this.message = message
        this.icon = icon
    }

    setWithOffset() {
        this.withOffset = true
        return this
    }

    static addListener(owner: any, listener: ToastListener) {
        this.listeners.set(owner, listener)
    }

    static removeListener(owner: any) {
        this.listeners.delete(owner)
    }

    static callListeners(toast: Toast) {
        for (const listener of this.listeners.values()) {
            listener(toast)
        }
    }

    show() {
        Toast.callListeners(this)
    }
}
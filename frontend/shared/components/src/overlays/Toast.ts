import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors";

export type ToastListener = (toast: Toast) => void

export class ToastButton {
    text: string;
    icon: string | null;
    action: () => void;
    
    constructor(text: string, action: () => void, icon: string | null = null) {
        this.text = text
        this.action = action
        this.icon = icon
    }
}

export class Toast {
    protected static listeners: Map<any, ToastListener> = new Map()
    message: string
    icon: string | null
    withOffset = false
    progress: number | null = null
    button: ToastButton | null = null

    autohideAfter: number | null = 5000

    doHide: (() => void) | null = null
    action:  (() => void) | null = null

    constructor(message: string, icon: string | null = null) {
        this.message = message
        this.icon = icon
    }

    static fromError(errors: Error): Toast {
        let simpleErrors!: SimpleErrors
        if (isSimpleError(errors)) {
            simpleErrors = new SimpleErrors(errors)
        } else if (isSimpleErrors(errors)) {
            simpleErrors = errors
        } else {
            simpleErrors = new SimpleErrors(new SimpleError({
                code: "unknown_error",
                message: errors.message
            }))
        }
        console.log(simpleErrors.errors)
        return new Toast(simpleErrors.getHuman(), "error red")
    }

    setProgress(progress: number | null) {
        this.progress = progress
        return this
    }

    setHide(ms: number | null) {
        this.autohideAfter = ms 
        return this
    }

    setButton(button: ToastButton | null) {
        this.button = button 
        return this
    }

    setAction(action: (() => void) | null) {
        this.action = action 
        return this
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
        return this
    }

    hide() {
        if (this.doHide) {
            this.doHide();
            this.doHide = null;
        }
        return this
    }
}
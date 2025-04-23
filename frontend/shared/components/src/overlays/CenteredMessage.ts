import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors'

export type CenteredMessageListener = (centeredMessage: CenteredMessage) => unknown

export class CenteredMessageButton {
    text: string
    href?: string
    action: (() => Promise<any>) | null = null
    type: "destructive" | "secundary" | "primary"
    icon: string | null = null
    loading = false

    constructor(text, settings?: {
        action?: (() => Promise<any>);
        type?: "destructive" | "secundary" | "primary";
        icon?: string ;
        href?: string
    }) {
        this.text = text
        this.action = settings?.action ?? null
        this.type = settings?.type ?? "primary"
        this.icon = settings?.icon ?? null
        this.href = settings?.href

    }
}

export class CenteredMessage {
    protected static listeners: Map<any, CenteredMessageListener> = new Map()

    type = "none"
    title = ""
    description = ""


    buttons: CenteredMessageButton[] = []

    doHide: (() => void) | null = null

    constructor(title: string, description = "", type = "none") {
        this.title = title
        this.description = description
        this.type = type
    }

    static fromError(errors: unknown) {
        let simpleErrors: SimpleErrors
        if (isSimpleError(errors)) {
            simpleErrors = new SimpleErrors(errors)
        } else if (isSimpleErrors(errors)) {
            simpleErrors = errors
        } else {
            simpleErrors = new SimpleErrors(new SimpleError({
                code: "unknown_error",
                message: (errors as any).message
            }))
        }

        if (simpleErrors.hasCode("network_error") || simpleErrors.hasCode("network_timeout")) {
            return new CenteredMessage($t(`18e54ffc-b12d-4175-9128-46446334942f`), $t(`ea7a24eb-79de-40ca-8ebf-1ca4a600587e`), "error")
        }

        return new CenteredMessage(simpleErrors.getHuman(), "", "error")
    }

    static addListener(owner: any, listener: CenteredMessageListener) {
        this.listeners.set(owner, listener)
    }

    static removeListener(owner: any) {
        this.listeners.delete(owner)
    }

    static callListeners(toast: CenteredMessage) {
        for (const listener of this.listeners.values()) {
            listener(toast)
        }
    }

    addCloseButton(text = $t(`bef7a2f9-129a-4e1c-b8d2-9003ff0a1f8b`), action?: (() => Promise<any>) | undefined) {
        this.buttons.push(new CenteredMessageButton(text, { type: "secundary", action }))
        return this
    }

    addButton(button: CenteredMessageButton) {
        this.buttons.push(button)
        return this
    }

    show() {
        CenteredMessage.callListeners(this)
        return this
    }

    hide() {
        if (this.doHide) {
            this.doHide();
            this.doHide = null;
        }
        return this
    }

    static confirm(text: string, confirmText: string, description = "", cancelText?: string, destructive = true): Promise<boolean> {
        return new Promise((resolve) => {
            new CenteredMessage(text, description).addButton(new CenteredMessageButton(confirmText, {
                action: () => {
                    resolve(true)
                    return Promise.resolve()
                },
                type: destructive ? "destructive" : "primary"
            })).addButton(new CenteredMessageButton(cancelText ?? $t(`bc53d7e6-3dbc-45ec-beeb-5f132fcbedb9`), {
                action: () => {
                    resolve(false)
                    return Promise.resolve()
                },
                type: "secundary"
            })).show()
        })
    }
}

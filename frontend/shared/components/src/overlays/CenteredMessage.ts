export type CenteredMessageListener = (centeredMessage: CenteredMessage) => void

export class CenteredMessageButton {
    text: string
    action: (() => Promise<any>) | null = null
    type: "destructive" | "secundary" | "primary"
    icon: string | null = null
    loading = false

    constructor(text, settings?: {
        action?: (() => Promise<any>);
        type?: "destructive" | "secundary" | "primary";
        icon?: string ;
    }) {
        this.text = text
        this.action = settings?.action ?? null
        this.type = settings?.type ?? "primary"
        this.icon = settings?.icon ?? null

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

    addCloseButton(text = "Sluiten") {
        this.buttons.push(new CenteredMessageButton(text, { type: "secundary" }))
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
}
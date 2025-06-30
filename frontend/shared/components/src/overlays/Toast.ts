import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { reactive } from 'vue';

export type ToastListener = (toast: Toast) => void;

export class ToastButton {
    text: string;
    icon: string | null;
    action: () => void;

    href: string | null;
    download: string | null;

    constructor(text: string, action?: () => void, icon: string | null = null) {
        this.text = text;
        this.action = action ?? (() => {});
        this.icon = icon;
    }

    setHref(href: string) {
        this.href = href;
        return this;
    }

    setDownload(download: string) {
        this.download = download;
        return this;
    }
}

export class Toast {
    protected static listeners: Map<any, ToastListener> = new Map();
    message: string;
    icon: string | null;
    withOffset = false;
    progress: number | null = null;
    button: ToastButton | null = null;
    forceButtonClick = false;

    autohideAfter: number | null = 8_000;

    doHide: (() => void) | null = null;
    action: (() => void) | null = null;

    constructor(message: string, icon: string | null = null) {
        this.message = message;
        this.icon = icon;

        // Constructor hack: we override Toast with a reactive toast
        // this fixes issues with editing the toast, because otherwise it would not get updated
        return reactive(this);
    }

    static success(message: string): Toast {
        return new Toast(message, 'success green');
    }

    static error(message: string): Toast {
        return new Toast(message, 'error red');
    }

    static warning(message: string): Toast {
        return new Toast(message, 'warning yellow');
    }

    static info(message: string): Toast {
        return new Toast(message, 'info');
    }

    static fromError(errors: unknown): Toast {
        let simpleErrors!: SimpleErrors;
        if (isSimpleError(errors)) {
            simpleErrors = new SimpleErrors(errors);
        }
        else if (isSimpleErrors(errors)) {
            simpleErrors = errors;
        }
        else {
            simpleErrors = new SimpleErrors(new SimpleError({
                code: 'unknown_error',
                message: (errors as Error).message,
            }));
        }

        if (Request.isNetworkError((errors as Error))) {
            return new Toast($t(`34b25231-f7d6-41f4-aa83-5d8f973e9890`), 'error red');
        }
        return new Toast(simpleErrors.getHuman(), 'error red');
    }

    setProgress(progress: number | null) {
        this.progress = progress;
        return this;
    }

    setHide(ms: number | null) {
        this.autohideAfter = ms;
        return this;
    }

    setButton(button: ToastButton | null) {
        this.button = button;
        return this;
    }

    setForceButtonClick() {
        this.forceButtonClick = true;
        return this;
    }

    setAction(action: (() => void) | null) {
        this.action = action;
        return this;
    }

    setIcon(icon: string | null) {
        this.icon = icon;
        return this;
    }

    setWithOffset() {
        this.withOffset = true;
        return this;
    }

    static addListener(owner: any, listener: ToastListener) {
        this.listeners.set(owner, listener);
    }

    static removeListener(owner: any) {
        this.listeners.delete(owner);
    }

    static callListeners(toast: Toast) {
        for (const listener of this.listeners.values()) {
            listener(toast);
        }
    }

    show() {
        if (Toast.listeners.size === 0) {
            console.log('Delayed Toast show');
            // Delayed show
            setTimeout(() => {
                this.show();
            }, 1000);
        }
        else {
            Toast.callListeners(this);
        }
        return this;
    }

    hide() {
        if (this.doHide) {
            this.doHide();
            this.doHide = null;
        }
        return this;
    }
}

import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { reactive } from 'vue';

export type CenteredMessageListener = (centeredMessage: CenteredMessage) => unknown;

type CenteredMessageCheckbox = {
    text: string;
};

export class CenteredMessageButton {
    text: string;
    href?: string;
    action: (() => Promise<any>) | null = null;
    type: 'destructive' | 'secundary' | 'primary';
    icon: string | null = null;
    loading = false;
    disabled = false;
    /**
     * If true, the button will only be enabled if the checkbox is checked.
     * Do not forget to add a checkbox to the CenteredMessage first.
     */
    requireAcceptCheckbox = false;

    constructor(text, settings?: {
        action?: (() => Promise<any>);
        type?: 'destructive' | 'secundary' | 'primary';
        icon?: string ;
        href?: string;
        disabled?: boolean;
        requireAcceptCheckbox?: boolean;
    }) {
        this.text = text;
        this.action = settings?.action ?? null;
        this.type = settings?.type ?? 'primary';
        this.icon = settings?.icon ?? null;
        this.href = settings?.href;
        this.disabled = settings?.disabled ?? false;
        this.requireAcceptCheckbox = settings?.requireAcceptCheckbox ?? false;
    }
}

export class CenteredMessage {
    protected static listeners: Map<any, CenteredMessageListener> = new Map();

    type = 'none';
    title = '';
    description = '';

    buttons: CenteredMessageButton[] = [];
    checkbox?: CenteredMessageCheckbox;

    doHide: (() => void) | null = null;

    constructor(title: string, description = '', type = 'none') {
        this.title = title;
        this.description = description;
        this.type = type;
    }

    static fromError(errors: unknown) {
        let simpleErrors: SimpleErrors;
        if (isSimpleError(errors)) {
            simpleErrors = new SimpleErrors(errors);
        }
        else if (isSimpleErrors(errors)) {
            simpleErrors = errors;
        }
        else {
            simpleErrors = new SimpleErrors(new SimpleError({
                code: 'unknown_error',
                message: (errors as any).message,
            }));
        }

        if (simpleErrors.hasCode('network_error') || simpleErrors.hasCode('network_timeout')) {
            return new CenteredMessage($t(`%gT`), $t(`%gU`), 'error');
        }

        return new CenteredMessage(simpleErrors.getHuman(), '', 'error');
    }

    static addListener(owner: any, listener: CenteredMessageListener) {
        this.listeners.set(owner, listener);
    }

    static removeListener(owner: any) {
        this.listeners.delete(owner);
    }

    static callListeners(toast: CenteredMessage) {
        for (const listener of this.listeners.values()) {
            listener(toast);
        }
    }

    addCloseButton(text = $t(`%9b`), action?: (() => Promise<any>)) {
        this.buttons.push(new CenteredMessageButton(text, { type: 'secundary', action }));
        return this;
    }

    addButton(button: CenteredMessageButton) {
        this.buttons.push(button);
        return this;
    }

    addCheckbox(checkbox: CenteredMessageCheckbox) {
        this.checkbox = checkbox;
        return this;
    }

    show() {
        CenteredMessage.callListeners(this);
        return this;
    }

    hide() {
        if (this.doHide) {
            this.doHide();
            this.doHide = null;
        }
        return this;
    }

    /**
     * @param requireCheckbox if a text is provided a checkbox has to be checked first before the message can be confirmed
     * @returns
     */
    static confirm(text: string, confirmText: string, description = '', cancelText?: string, destructive = true, requireCheckbox: string | undefined = undefined): Promise<boolean> {
        return this.show({
            title: text,
            description,
            buttons: [
                {
                    text: confirmText,
                    type: destructive ? 'destructive' : 'primary',
                    value: true,
                    availabilityDelay: destructive && confirmText !== $t('%4X') ? 1_000 : undefined,
                    requireAcceptCheckbox: requireCheckbox !== undefined,
                },
                {
                    text: cancelText ?? $t(`%9b`),
                    type: 'secundary',
                    value: false,
                },
            ],
            checkbox: requireCheckbox
                ? {
                        text: requireCheckbox,
                    }
                : undefined,
        });
    }

    static show<
        // Some magic to make sure TypeScript infers the return type of the promise based on the value of the buttons
        const Buttons extends readonly {
            text: string;
            value: string | boolean;
            type?: 'destructive' | 'primary' | 'secundary';
            icon?: string;
            availabilityDelay?: number;
            requireAcceptCheckbox?: boolean;
        }[],
    >(options: {
        title: string;
        description?: string;
        buttons: Buttons;
        checkbox?: CenteredMessageCheckbox;
    }): Promise<Buttons[number]['value']> {
        return new Promise((resolve) => {
            const message = new CenteredMessage(options.title, options.description);

            for (const data of options.buttons) {
                let button = new CenteredMessageButton(data.text, {
                    action: () => {
                        resolve(data.value);
                        return Promise.resolve();
                    },
                    type: data.type as any ?? 'primary',
                    icon: data.icon ?? undefined,
                    disabled: data.availabilityDelay ? true : false,
                    requireAcceptCheckbox: data.requireAcceptCheckbox,
                });
                // Make it reactive, otherwise we cannot alter the loading state here
                button = reactive(button);
                message.addButton(
                    button,
                );

                if (data.availabilityDelay) {
                    setTimeout(() => {
                        button.disabled = false;
                    }, data.availabilityDelay + 300); // 300 ms for delay presenting the message
                }
            }

            if (options.checkbox) {
                message.addCheckbox(options.checkbox);
            }

            message.show();
        });
    }
}

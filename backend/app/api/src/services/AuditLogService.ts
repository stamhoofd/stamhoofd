import { Model, ModelEvent } from '@simonbackx/simple-database';
import { AuditLogSource } from '@stamhoofd/structures';
import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditLogContextSettings = {
    disable?: boolean;
    source?: AuditLogSource;
    userId?: string | null;

    // If no userId is known, fallback to this userId
    // this is useful e.g. for side effects of webhooks where the webhook calls but we don't have the userid in the request, still the action is tied to a user
    fallbackUserId?: string | null;
    fallbackOrganizationId?: string | null;
};
export const modelLogDefinitions = new Map<typeof Model, { logEvent: (event: ModelEvent) => Promise<any> }>();

export class AuditLogService {
    private constructor() { }
    static disableLocalStore = new AsyncLocalStorage<AuditLogContextSettings>();

    static disable<T>(run: () => T): T {
        return this.setContext({ disable: true }, run);
    }

    static setContext<T>(context: AuditLogContextSettings, run: () => T): T {
        const currentContext = this.getContext() ?? {};
        return this.disableLocalStore.run({ ...currentContext, ...context }, () => {
            return run();
        });
    }

    static isDisabled(): boolean {
        const c = this.getContext();

        if (c && c.disable === true) {
            return true;
        }

        return false;
    }

    static getContext(): AuditLogContextSettings | null {
        const c = this.disableLocalStore.getStore();
        return c ?? null;
    }

    static listening = false;

    static listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        Model.modelEventBus.addListener(this, async (event) => {
            const modelType = event.model.static as typeof Model;
            const definition = modelLogDefinitions.get(modelType);

            if (!definition) {
                return;
            }

            if (this.isDisabled()) {
                return;
            }

            await definition.logEvent(event);
        });
    }
};

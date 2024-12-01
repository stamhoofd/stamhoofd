import { Model, ModelEvent } from '@simonbackx/simple-database';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RegistrationLogger } from '../audit-logs/RegistrationLogger';
import { GroupLogger } from '../audit-logs/GroupLogger';
import { OrganizationLogger } from '../audit-logs/OrganizationLogger';
import { PlatformLogger } from '../audit-logs/PlatformLogger';
import { EventLogger } from '../audit-logs/EventLogger';
import { RegistrationPeriodLogger } from '../audit-logs/RegistrationPeriodLogger';
import { OrganizationRegistrationPeriodLogger } from '../audit-logs/OrganizationRegistrationPeriodLogger';
import { StripeAccountLogger } from '../audit-logs/StripeAccountLogger';
import { MemberLogger } from '../audit-logs/MemberLogger';
import { WebshopLogger } from '../audit-logs/WebshopLogger';
import { OrderLogger } from '../audit-logs/OrderLogger';

export class AuditLogService {
    private constructor() { }
    static disableLocalStore = new AsyncLocalStorage<boolean>();

    static disable<T>(run: () => T): T {
        return this.disableLocalStore.run(true, () => {
            return run();
        });
    }

    static isDisabled(): boolean {
        const c = this.disableLocalStore.getStore();

        if (!c) {
            return false;
        }

        return true;
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

            console.log('Model event', {
                ...event,
                model: event.model.static.name,
            });

            if (this.isDisabled()) {
                console.log('Audit log disabled');
                return;
            }

            await definition.logEvent(event);
        });
    }
};

const modelLogDefinitions = new Map<typeof Model, { logEvent: (event: ModelEvent) => Promise<any> }>();

modelLogDefinitions.set(RegistrationLogger.model, RegistrationLogger);
modelLogDefinitions.set(GroupLogger.model, GroupLogger);
modelLogDefinitions.set(OrganizationLogger.model, OrganizationLogger);
modelLogDefinitions.set(PlatformLogger.model, PlatformLogger);
modelLogDefinitions.set(EventLogger.model, EventLogger);
modelLogDefinitions.set(RegistrationPeriodLogger.model, RegistrationPeriodLogger);
modelLogDefinitions.set(OrganizationRegistrationPeriodLogger.model, OrganizationRegistrationPeriodLogger);
modelLogDefinitions.set(StripeAccountLogger.model, StripeAccountLogger);
modelLogDefinitions.set(MemberLogger.model, MemberLogger);
modelLogDefinitions.set(WebshopLogger.model, WebshopLogger);
modelLogDefinitions.set(OrderLogger.model, OrderLogger);

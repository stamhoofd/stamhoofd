import { Model, ModelEvent } from '@simonbackx/simple-database';
import { AuditLogSource } from '@stamhoofd/structures';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DocumentTemplateLogger } from '../audit-logs/DocumentTemplateLogger';
import { EventLogger } from '../audit-logs/EventLogger';
import { GroupLogger } from '../audit-logs/GroupLogger';
import { MemberLogger } from '../audit-logs/MemberLogger';
import { MemberPlatformMembershipLogger } from '../audit-logs/MemberPlatformMembershipLogger';
import { MemberResponsibilityRecordLogger } from '../audit-logs/MemberResponsibilityRecordLogger';
import { OrderLogger } from '../audit-logs/OrderLogger';
import { OrganizationLogger } from '../audit-logs/OrganizationLogger';
import { OrganizationRegistrationPeriodLogger } from '../audit-logs/OrganizationRegistrationPeriodLogger';
import { PaymentLogger } from '../audit-logs/PaymentLogger';
import { PlatformLogger } from '../audit-logs/PlatformLogger';
import { RegistrationLogger } from '../audit-logs/RegistrationLogger';
import { RegistrationPeriodLogger } from '../audit-logs/RegistrationPeriodLogger';
import { StripeAccountLogger } from '../audit-logs/StripeAccountLogger';
import { WebshopLogger } from '../audit-logs/WebshopLogger';
import { EmailLogger } from '../audit-logs/EmailLogger';
import { EmailTemplateLogger } from '../audit-logs/EmailTemplateLogger';
import { EmailAddressLogger } from '../audit-logs/EmailAddressLogger';
import { UserLogger } from '../audit-logs/UserLogger';

export type AuditLogContextSettings = {
    disable?: boolean;
    source?: AuditLogSource;
    userId?: string | null;

    // If no userId is known, fallback to this userId
    // this is useful e.g. for side effects of webhooks where the webhook calls but we don't have the userid in the request, still the action is tied to a user
    fallbackUserId?: string | null;
    fallbackOrganizationId?: string | null;
};

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
modelLogDefinitions.set(PaymentLogger.model, PaymentLogger);
modelLogDefinitions.set(MemberPlatformMembershipLogger.model, MemberPlatformMembershipLogger);
modelLogDefinitions.set(MemberResponsibilityRecordLogger.model, MemberResponsibilityRecordLogger);
modelLogDefinitions.set(DocumentTemplateLogger.model, DocumentTemplateLogger);
modelLogDefinitions.set(EmailLogger.model, EmailLogger);
modelLogDefinitions.set(EmailTemplateLogger.model, EmailTemplateLogger);
modelLogDefinitions.set(EmailAddressLogger.model, EmailAddressLogger);
modelLogDefinitions.set(UserLogger.model, UserLogger);

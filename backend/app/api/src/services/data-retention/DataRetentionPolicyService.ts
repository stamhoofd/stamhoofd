import { SimpleError } from '@common/errors';
import type { Organization, User } from '@stamhoofd/models';
import { DataRetentionPolicy } from '@stamhoofd/models';
import type { DataRetentionCategory } from '@stamhoofd/structures';
import { DATA_RETENTION_WAITING_DAYS, DataRetentionPolicy as DataRetentionPolicyStruct, DataRetentionSettings, DataRetentionTerms, getDataRetentionCategories, isEarlierDataRetentionDeletion, resolveDataRetentionTerms } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { TenantContext } from '../../helpers/TenantContext.js';
import { DataRetentionAuditLogService } from './DataRetentionAuditLogService.js';

export class DataRetentionPolicyService {
    /**
     * Without an organization in the request, the policy of the platform is used.
     * Changing a term requires a fresh authentication, viewing or cancelling does not because that cannot erase data.
     */
    static async authenticate({ fresh }: { fresh: boolean }) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = fresh ? await Context.authenticateFresh() : await Context.authenticate();

        const allowed = organization ? await Context.auth.hasFullAccess(organization.id) : Context.auth.hasPlatformFullAccess();
        if (!allowed) {
            throw Context.auth.error();
        }

        if (!organization && STAMHOOFD.userMode === 'organization') {
            throw new SimpleError({
                code: 'not_available',
                message: 'Data retention can only be configured per organization in this mode',
                statusCode: 400,
            });
        }

        if (!await Context.checkFeatureFlag('data-retention')) {
            throw new SimpleError({
                code: 'not_available',
                message: 'Data retention is not enabled',
                human: $t('Bewaartermijnen zijn nog niet beschikbaar.'),
                statusCode: 400,
            });
        }
        return { organization, user };
    }

    static async getSettings(organization: Organization | null): Promise<DataRetentionSettings> {
        const organizationId = organization?.id ?? null;
        const tenantId = TenantContext.currentOrRoot.tenantId;
        const isOrganizationWithinPlatform = this.isOrganizationWithinPlatform(organization);
        const categories = getDataRetentionCategories({ isOrganizationWithinPlatform });

        return DataRetentionSettings.create({
            policies: await Promise.all(categories.map(category => DataRetentionPolicy.getStructureFor(tenantId, organizationId, category))),
            platformPolicies: isOrganizationWithinPlatform
                ? await Promise.all(categories.map(category => DataRetentionPolicy.getStructureFor(tenantId, null, category)))
                : [],
        });
    }

    /**
     * A change that can erase data sooner waits. Any other change applies immediately and replaces a pending change.
     */
    static async update(organization: Organization | null, user: User, category: DataRetentionCategory, terms: DataRetentionTerms) {
        const organizationId = organization?.id ?? null;
        const tenantId = TenantContext.currentOrRoot.tenantId;

        this.assertCategoryAvailable(organization, category);
        terms.validate(category);

        const now = new Date();
        const model = await DataRetentionPolicy.getFor(tenantId, organizationId, category);
        const policy = model?.getStructure() ?? DataRetentionPolicy.getDefaultStructure(organizationId, category);
        const before = policy.getActiveTerms(now);

        const isEarlier = await this.isEarlierDeletion(organization, category, before, terms, now);
        const hasWaitingChange = !!policy.pendingFrom && policy.pendingFrom > now;

        if (isEarlier && hasWaitingChange && policy.pendingTerms?.isSameAs(terms)) {
            return;
        }

        if (!isEarlier && !hasWaitingChange && before.isSameAs(terms)) {
            return;
        }

        const updated = model ?? new DataRetentionPolicy();
        updated.tenantId = tenantId;
        updated.organizationId = organizationId;
        updated.category = category;

        let from = now;
        if (isEarlier) {
            from = new Date(now.getTime() + DATA_RETENTION_WAITING_DAYS * 24 * 60 * 60 * 1000);
            from.setMilliseconds(0);
            updated.setTerms(before);
            updated.setPendingTerms({ terms, from });
        }
        else {
            updated.setTerms(terms);
            updated.setPendingTerms(null);
        }
        await updated.save();

        await DataRetentionAuditLogService.logPolicyChanged(user, updated, before, terms, from);
    }

    static async cancelPendingChange(organization: Organization | null, user: User, category: DataRetentionCategory) {
        const model = await DataRetentionPolicy.getFor(TenantContext.currentOrRoot.tenantId, organization?.id ?? null, category);
        const policy = model?.getStructure();
        const now = new Date();

        if (!model || !policy?.pendingTerms || !policy.pendingFrom || policy.pendingFrom <= now) {
            throw new SimpleError({
                code: 'not_found',
                message: 'No pending change found',
                human: $t('Er wacht geen wijziging meer op deze termijn.'),
                statusCode: 404,
            });
        }

        model.setPendingTerms(null);
        await model.save();

        await DataRetentionAuditLogService.logPendingChangeCancelled(user, model, policy.pendingTerms);
    }

    /**
     * An organization compares what really applies before and after, because its term can be overruled by the platform.
     * A platform compares its own terms: it cannot know the terms of every organization, and removing a term can make a shorter one apply.
     */
    private static async isEarlierDeletion(organization: Organization | null, category: DataRetentionCategory, before: DataRetentionTerms, after: DataRetentionTerms, now: Date): Promise<boolean> {
        if (!organization) {
            return isEarlierDataRetentionDeletion(before, after, { removedTermIsEarlier: true });
        }

        const platform = this.isOrganizationWithinPlatform(organization)
            ? await DataRetentionPolicy.getStructureFor(TenantContext.currentOrRoot.tenantId, null, category)
            : null;

        return isEarlierDataRetentionDeletion(
            resolveDataRetentionTerms(platform, DataRetentionPolicyStruct.create({ category, terms: before }), now),
            resolveDataRetentionTerms(platform, DataRetentionPolicyStruct.create({ category, terms: after }), now),
        );
    }

    private static assertCategoryAvailable(organization: Organization | null, category: DataRetentionCategory) {
        if (!getDataRetentionCategories({ isOrganizationWithinPlatform: this.isOrganizationWithinPlatform(organization) }).includes(category)) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'category',
                message: 'This category can only be configured by the platform',
                human: $t('Deze termijn kan enkel de koepel instellen.'),
            });
        }
    }

    private static isOrganizationWithinPlatform(organization: Organization | null): boolean {
        return !!organization && STAMHOOFD.userMode === 'platform';
    }
}

import { SimpleError } from '@common/errors';
import type { Organization, User } from '@stamhoofd/models';
import { DataRetentionPolicy, DataRetentionRun, Platform } from '@stamhoofd/models';
import { SQLWhereSign } from '@stamhoofd/sql';
import type { DataRetentionCategory } from '@stamhoofd/structures';
import {
    DATA_RETENTION_WAITING_DAYS,
    DataRetentionPolicy as DataRetentionPolicyStruct,
    DataRetentionSettings,
    DataRetentionTerms,
    getDataRetentionCategories,
    isDataRetentionEnabled,
    isEarlierDataRetentionDeletion,
    resolveDataRetentionTerms,
} from '@stamhoofd/structures';

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

        const allowed = organization
            ? await Context.auth.hasFullAccess(organization.id)
            : Context.auth.hasPlatformFullAccess();
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

        const platform = await Platform.getSharedStruct();
        if (
            !isDataRetentionEnabled({
                platformFeatureFlags: platform.config.featureFlags,
                organizationFeatureFlags: organization?.privateMeta.featureFlags ?? null,
            })
        ) {
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
            policies: await Promise.all(
                categories.map((category) =>
                    DataRetentionPolicy.getStructureFor(tenantId, organizationId, category),
                ),
            ),
            platformPolicies: isOrganizationWithinPlatform
                ? await Promise.all(
                      categories.map((category) =>
                          DataRetentionPolicy.getStructureFor(tenantId, null, category),
                      ),
                  )
                : [],
            overview: await DataRetentionRun.getOverview(
                tenantId,
                organizationId ?? DataRetentionRun.PLATFORM_SCOPE,
            ),
        });
    }

    /**
     * A change that can erase data sooner waits. Any other change applies immediately and replaces a pending change.
     */
    static async update(
        organization: Organization | null,
        user: User,
        category: DataRetentionCategory,
        terms: DataRetentionTerms,
    ) {
        const planned = await this.planUpdate(organization, category, terms, new Date());
        if (!planned.changed) {
            return;
        }

        const updated = planned.model ?? new DataRetentionPolicy();
        updated.tenantId = TenantContext.currentOrRoot.tenantId;
        updated.organizationId = organization?.id ?? null;
        updated.category = category;
        updated.setTerms(planned.policy.terms);
        updated.setPendingTerms(
            planned.policy.pendingTerms && planned.policy.pendingFrom
                ? { terms: planned.policy.pendingTerms, from: planned.policy.pendingFrom }
                : null,
        );
        await updated.save();

        await DataRetentionAuditLogService.logPolicyChanged(
            user,
            updated,
            planned.before,
            terms,
            planned.from,
        );
    }

    /**
     * What saving these terms would store, without saving: also used to count what they would do before saving.
     * policy is the policy of this level after saving. from is when the new terms start to apply.
     */
    static async planUpdate(
        organization: Organization | null,
        category: DataRetentionCategory,
        terms: DataRetentionTerms,
        now: Date,
    ): Promise<{
        model: DataRetentionPolicy | null;
        policy: DataRetentionPolicyStruct;
        before: DataRetentionTerms;
        from: Date;
        waits: boolean;
        changed: boolean;
    }> {
        const organizationId = organization?.id ?? null;
        const tenantId = TenantContext.currentOrRoot.tenantId;

        this.assertCategoryAvailable(organization, category);
        terms.validate(category);

        const model = await DataRetentionPolicy.getFor(tenantId, organizationId, category);
        const current =
            model?.getStructure() ??
            DataRetentionPolicy.getDefaultStructure(organizationId, category);
        const before = current.getActiveTerms(now);

        const isEarlier = await this.isEarlierDeletion(organization, category, before, terms, now);
        const hasWaitingChange = !!current.pendingFrom && current.pendingFrom > now;

        if (isEarlier && hasWaitingChange && current.pendingTerms?.isSameAs(terms)) {
            // Saving the same waiting change again keeps its date
            return {
                model,
                policy: current,
                before,
                from: current.pendingFrom!,
                waits: true,
                changed: false,
            };
        }

        if (!isEarlier) {
            return {
                model,
                policy: DataRetentionPolicyStruct.create({ category, terms }),
                before,
                from: now,
                waits: false,
                changed: hasWaitingChange || !before.isSameAs(terms),
            };
        }

        const from = new Date(now.getTime() + DATA_RETENTION_WAITING_DAYS * 24 * 60 * 60 * 1000);
        from.setMilliseconds(0);
        return {
            model,
            policy: DataRetentionPolicyStruct.create({
                category,
                terms: before,
                pendingTerms: terms,
                pendingFrom: from,
            }),
            before,
            from,
            waits: true,
            changed: true,
        };
    }

    static async cancelPendingChange(
        organization: Organization | null,
        user: User,
        category: DataRetentionCategory,
    ) {
        const model = await DataRetentionPolicy.getFor(
            TenantContext.currentOrRoot.tenantId,
            organization?.id ?? null,
            category,
        );
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

        await DataRetentionAuditLogService.logPendingChangeCancelled(
            user,
            model,
            policy.pendingTerms,
        );
    }

    /**
     * Moves pending changes that started to apply to the current terms, and logs that they did.
     * The planner already follows a pending change from pendingFrom on, so this only keeps the stored terms and the log in line with that.
     */
    static async applyDuePendingChanges(tenantId: string, now: Date) {
        const policies = await DataRetentionPolicy.select()
            .where('tenantId', tenantId)
            .where('pendingFrom', SQLWhereSign.LessEqual, now)
            .fetch();

        for (const policy of policies) {
            const applied = policy.getStructure().pendingTerms!;
            policy.setTerms(applied);
            policy.setPendingTerms(null);
            await policy.save();
            await DataRetentionAuditLogService.logPendingChangeApplied(policy, applied);
        }
    }

    /**
     * An organization compares what really applies before and after, because its term can be overruled by the platform.
     * A platform compares its own terms: it cannot know the terms of every organization, and removing a term can make a shorter one apply.
     */
    private static async isEarlierDeletion(
        organization: Organization | null,
        category: DataRetentionCategory,
        before: DataRetentionTerms,
        after: DataRetentionTerms,
        now: Date,
    ): Promise<boolean> {
        if (!organization) {
            return isEarlierDataRetentionDeletion(before, after, { removedTermIsEarlier: true });
        }

        const platform = this.isOrganizationWithinPlatform(organization)
            ? await DataRetentionPolicy.getStructureFor(
                  TenantContext.currentOrRoot.tenantId,
                  null,
                  category,
              )
            : null;

        return isEarlierDataRetentionDeletion(
            resolveDataRetentionTerms(
                platform,
                DataRetentionPolicyStruct.create({ category, terms: before }),
                now,
            ),
            resolveDataRetentionTerms(
                platform,
                DataRetentionPolicyStruct.create({ category, terms: after }),
                now,
            ),
        );
    }

    private static assertCategoryAvailable(
        organization: Organization | null,
        category: DataRetentionCategory,
    ) {
        if (
            !getDataRetentionCategories({
                isOrganizationWithinPlatform: this.isOrganizationWithinPlatform(organization),
            }).includes(category)
        ) {
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

import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, deepSetArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { GlobalEventBus } from '@stamhoofd/components/EventBus';
import { Group, Organization, OrganizationAdmins } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { inject, toRef } from 'vue';
import type { SessionContext } from './SessionContext';
import { SessionManager } from './SessionManager';
import { clearOrganizationPeriodsCache } from './organizationPeriodsCache.js';

export function useOrganizationManager(): Ref<OrganizationManager> {
    return toRef(inject<OrganizationManager>('$organizationManager')) as any as Ref<OrganizationManager>;
}

/**
 * Convenient access to the organization of the current session.
 *
 * Note: this is bad practice and we should replace this with hooks as much as possible in the future.
 */
export class OrganizationManager {
    $context: SessionContext;

    constructor($context: SessionContext) {
        // Make reactive
        this.$context = $context;
    }

    get organization() {
        return this.$context.organization!;
    }

    set organization(organization: Organization) {
        this.$context.updateOrganization(organization);
    }

    get user() {
        return this.$context.user!;
    }

    getPatch() {
        return Organization.patch({
            id: this.organization.id,
        });
    }

    async forceUpdate() {
        await this.$context.fetchOrganization(false);
    }

    /**
     * @deprecated Use usePatchOrganization from @stamhoofd/components/organizations/usePatchOrganization instead.
     *
     * Example:
     * const patchOrganization = usePatchOrganization();
     * await patchOrganization(Organization.patch({ ... }));
     *
     * See frontend/shared/components/src/organizations/usePatchOrganization.ts and
     * frontend/app/dashboard/src/views/dashboard/settings/RegistrationPaymentSettingsView.vue.
     */
    async patch(patch: AutoEncoderPatchType<Organization>, options: { shouldRetry?: boolean; owner?: any } = {}) {
        if (!this.$context.organization) {
            throw new SimpleError({
                code: 'no_organization',
                message: 'No organization loaded',
            });
        }

        patch.id = this.$context.organization.id;

        const response = await this.$context.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization',
            body: patch,
            decoder: Organization as Decoder<Organization>,
            shouldRetry: options.shouldRetry ?? false,
            owner: options.owner,
        });

        // Keep admins
        this.$context.updateOrganization(response.data);

        if (patch.period) {
            // Clear cached periods
            clearOrganizationPeriodsCache();

            // There is something fishy going on with the period that doesn't get set using deepSet (updateOrganization) - can't explain why atm
            // this fixes it for now
            // this.$context.organization.period = response.data.period;
        }

        // Call handlers: also update the stored organization in localstorage
        // + handle other listeners
        this.$context.callListeners('organization');

        // Save organization in localstorage
        this.save().catch(console.error);

        await GlobalEventBus.sendEvent('organization-updated', this.$context.organization);
    }

    async loadArchivedGroups({ owner }: { owner?: any }) {
        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/organization/archived-groups',
            decoder: new ArrayDecoder(Group as Decoder<Group>),
            owner,
        });

        return response.data.sort((a, b) => b.settings.endDate.getTime() - a.settings.endDate.getTime());
    }

    /**
     * Save organization in localstorage
     */
    async save() {
        // Save organization in localstorage
        if (this.$context.organization) {
            await SessionManager.addOrganizationToStorage(this.$context.organization);
        }
    }
}

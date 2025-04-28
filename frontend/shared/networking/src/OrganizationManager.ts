import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder, deepSetArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { GlobalEventBus } from '@stamhoofd/components';
import { LoginHelper, SessionContext, SessionManager } from '@stamhoofd/networking';
import { Group, Organization, OrganizationAdmins, OrganizationPatch, OrganizationRegistrationPeriod, RegistrationPeriodList } from '@stamhoofd/structures';
import { Ref, inject, toRef } from 'vue';

export function useOrganizationManager(): Ref<OrganizationManager> {
    return toRef(inject<OrganizationManager>('$organizationManager')) as any as Ref<OrganizationManager>;
}

/**
 * Convenient access to the organization of the current session
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
        return OrganizationPatch.create({
            id: this.organization.id,
        });
    }

    async forceUpdate() {
        await this.$context.fetchOrganization(false);
    }

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
        const admins = this.$context.organization.admins;

        this.$context.updateOrganization(response.data);

        if (admins && !response.data.admins && patch.admins) {
            this.$context.organization.admins = patch.admins.applyTo(admins);
        }

        // Call handlers: also update the stored organization in localstorage
        // + handle other listeners
        this.$context.callListeners('organization');

        // Save organization in localstorage
        this.save().catch(console.error);

        await GlobalEventBus.sendEvent('organization-updated', this.$context.organization);
    }

    async patchPeriods(patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>, options: { shouldRetry?: boolean; owner?: any } = {}) {
        const response = await this.$context.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/registration-periods',
            body: patch,
            decoder: new ArrayDecoder(OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>),
            shouldRetry: options.shouldRetry ?? false,
            owner: options.owner,
        });

        this.updatePeriods(response.data);
    }

    async patchPeriod(patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>, options: { shouldRetry?: boolean; owner?: any } = {}) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;
        arr.addPatch(patch);

        await this.patchPeriods(arr, options);
    }

    updatePeriods(periods: OrganizationRegistrationPeriod[]) {
        // Update in memory
        for (const period of this.organization.periods?.organizationPeriods ?? []) {
            const updated = periods.find(p => p.id === period.id);
            if (updated) {
                period.deepSet(updated);
            }
        }

        const updated = periods.find(p => p.id === this.organization.period.id);
        if (updated) {
            this.organization.period.deepSet(updated);
        }
    }

    async patchGroup(organizationPeriod: OrganizationRegistrationPeriod, patch: AutoEncoderPatchType<Group>, options: { shouldRetry?: boolean; owner?: any } = {}) {
        const periodPatch = OrganizationRegistrationPeriod.patch({
            id: organizationPeriod.id,
        });
        periodPatch.groups.addPatch(patch);
        await this.patchPeriod(periodPatch, options);
    }

    async loadAdmins(force = false, shouldRetry = true, owner?: any): Promise<OrganizationAdmins> {
        if (!force && this.organization.admins) {
            return this.organization as any;
        }

        const loaded = await LoginHelper.loadAdmins(this.$context, shouldRetry, owner);

        if (this.organization.admins) {
            deepSetArray(this.organization.admins, loaded.users);
        }
        else {
            this.organization.admins = loaded.users;
        }

        // Save organization in localstorage
        this.save().catch(console.error);

        return this.organization as any;
    }

    async loadPeriods(force = false, shouldRetry?: boolean, owner?: any) {
        if (!force && this.organization.periods) {
            return this.organization.periods;
        }

        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/organization/registration-periods',
            decoder: RegistrationPeriodList as Decoder<RegistrationPeriodList>,
            owner,
            shouldRetry: shouldRetry ?? false,
        });
        if (this.organization.periods) {
            this.organization.periods?.deepSet(response.data);
        }
        else {
            this.organization.periods = response.data;
        }
        return response.data;
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

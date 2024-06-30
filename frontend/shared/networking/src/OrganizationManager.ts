import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { LoginHelper, SessionContext, SessionManager } from '@stamhoofd/networking';
import { Group, Organization, OrganizationAdmins, OrganizationPatch, RegistrationPeriodList, STBillingStatus } from '@stamhoofd/structures';
import { Ref, inject, toRef } from 'vue';

export function useOrganizationManager(): Ref<OrganizationManager> {
    return toRef(inject<OrganizationManager>('$organizationManager') as OrganizationManager) as Ref<OrganizationManager>
}

/**
 * Convenient access to the organization of the current session
 */
export class OrganizationManager {
    $context: SessionContext

    constructor($context: SessionContext) {
        // Make reactive
        this.$context = $context
    }

    get organization() {
        return this.$context.organization!
    }

    set organization(organization: Organization) {
        this.$context.updateOrganization(organization)
    }

    get user() {
        return this.$context.user!
    }

    getPatch() {
        return OrganizationPatch.create({
            id: this.organization.id
        })
    }

    async forceUpdate() {
        await this.$context.fetchOrganization(false)
    }

    async patch(patch: AutoEncoderPatchType<Organization>, shouldRetry = false) {
        if (!this.$context.organization) {
            throw new SimpleError({
                code: "no_organization",
                message: "No organization loaded"
            })
        }

        const response = await this.$context.authenticatedServer.request({
            method: "PATCH",
            path: "/organization",
            body: patch,
            decoder: Organization as Decoder<Organization>,
            shouldRetry
        })

        // Keep admins
        const admins = this.$context.organization.admins

        this.$context.setOrganization(response.data)
        console.log("Organization updated", this.$context)

        if (admins && !response.data.admins && patch.admins) {
            this.$context.organization.admins = patch.admins.applyTo(admins)
        }

        // Call handlers: also update the stored organization in localstorage
        // + handle other listeners
        this.$context.callListeners("organization")

        // Save organization in localstorage
        this.save().catch(console.error)
    }

    async loadAdmins(force = false, shouldRetry = true, owner?: any): Promise<OrganizationAdmins> {
        if (!force && this.organization.admins) {
            return this.organization as any
        }

        const loaded = await LoginHelper.loadAdmins(this.$context, shouldRetry, owner)
        this.organization.admins = loaded.users

        // Save organization in localstorage
        this.save().catch(console.error)

        return this.organization as any
    }

    async loadPeriods(force = false, shouldRetry?: boolean, owner?: any) {
        if (!force && this.organization.periods) {
            return this.organization.periods
        }

        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/organization/registration-periods',
            decoder: RegistrationPeriodList as Decoder<RegistrationPeriodList>,
            owner,
            shouldRetry: shouldRetry ?? false,
        })
        this.organization.periods = response.data
        return response.data
    }

    async loadArchivedGroups({owner}: {owner?: any}) {
        const response = await this.$context.authenticatedServer.request({
            method: "GET",
            path: "/organization/archived-groups",
            decoder: new ArrayDecoder(Group as Decoder<Group>),
            owner
        })

        return response.data.sort((a, b) => b.settings.endDate.getTime() - a.settings.endDate.getTime())
    }

    /**
     * Save organization in localstorage
     */
    async save() {
        // Save organization in localstorage
        if (this.$context.organization) {
            await SessionManager.addOrganizationToStorage(this.$context.organization)
        }
    }

    async loadBillingStatus({owner, shouldRetry}: {owner?: any, shouldRetry?: boolean}) {
        return (await this.$context.authenticatedServer.request({
            method: "GET",
            path: "/billing/status",
            decoder: STBillingStatus as Decoder<STBillingStatus>,
            owner,
            shouldRetry
        })).data
    }
}

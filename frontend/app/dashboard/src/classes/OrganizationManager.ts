import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding'
import { LoginHelper, SessionManager } from '@stamhoofd/networking'
import { Organization, OrganizationAdmins, OrganizationPatch, STBillingStatus } from '@stamhoofd/structures'

/**
 * Convenient access to the organization of the current session
 */
export class OrganizationManagerStatic {
    get organization() {
        return SessionManager.currentSession!.organization!
    }

    set organization(organization: Organization) {
        SessionManager.currentSession!.updateOrganization(organization)
    }

    get user() {
        return SessionManager.currentSession!.user!
    }


    getPatch() {
        return OrganizationPatch.create({
            id: this.organization.id
        })
    }

    async patch(patch: AutoEncoderPatchType<Organization>, shouldRetry = false) {
        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: "PATCH",
            path: "/organization",
            body: patch,
            decoder: Organization as Decoder<Organization>,
            shouldRetry
        })

        // Keep admins
        const admins = this.organization.admins
        this.organization = response.data

        if (admins && !this.organization.admins && patch.admins) {
            this.organization.admins = patch.admins.applyTo(admins)
        }

        // Call handlers: also update the stored organization in localstorage
        // + handle other listeners
        SessionManager.currentSession!.callListeners("organization")

        // Save organization in localstorage
        this.save().catch(console.error)
    }

    async loadAdmins(force = false, shouldRetry = true, owner?: any): Promise<OrganizationAdmins> {
        if (!force && this.organization.admins) {
            return this.organization as any
        }

        const loaded = await LoginHelper.loadAdmins(shouldRetry, owner)
        this.organization.admins = loaded.users

        // Save organization in localstorage
        this.save().catch(console.error)

        return this.organization as any
    }

    /**
     * Save organization in localstorage
     */
    async save() {
        // Save organization in localstorage
        await SessionManager.addOrganizationToStorage(this.organization)
    }

    async loadBillingStatus() {
        return (await SessionManager.currentSession!.authenticatedServer.request({
            method: "GET",
            path: "/billing/status",
            decoder: STBillingStatus as Decoder<STBillingStatus>
        })).data
    }
}

export const OrganizationManager = new OrganizationManagerStatic()
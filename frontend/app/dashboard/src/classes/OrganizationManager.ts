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
        SessionManager.currentSession!.setOrganization(organization)
    }

    get user() {
        return SessionManager.currentSession!.user!
    }


    getPatch() {
        return OrganizationPatch.create({
            id: this.organization.id
        })
    }

    async patch(patch: AutoEncoderPatchType<Organization>) {
        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: "PATCH",
            path: "/organization",
            body: patch,
            decoder: Organization as Decoder<Organization>
        })

        // Keep admins + invites loaded
        const admins = this.organization.admins
        const invites = this.organization.invites
        this.organization.set(response.data)

        if (admins && !this.organization.admins && patch.admins) {
            this.organization.admins = patch.admins.applyTo(admins)
        }

        if (invites && !this.organization.invites && patch.invites) {
            this.organization.invites = patch.invites.applyTo(invites)
        }
    }

    async loadAdmins(force = false): Promise<OrganizationAdmins> {
        if (!force && this.organization.admins && this.organization.invites) {
            return this.organization as any
        }

        const loaded = await LoginHelper.loadAdmins()
        this.organization.admins = loaded.users
        this.organization.invites = loaded.invites
        return this.organization as any
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
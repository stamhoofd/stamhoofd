import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding'
import { SessionManager } from '@stamhoofd/networking'
import { Organization, OrganizationPatch } from '@stamhoofd/structures'

/**
 * Convenient access to the organization of the current session
 */
export class OrganizationManagerStatic {
    get organization() {
        return SessionManager.currentSession!.organization!
    }

    get user() {
        return SessionManager.currentSession!.user!
    }

    set organization(organization: Organization) {
        SessionManager.currentSession!.setOrganization(organization)
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
}

export const OrganizationManager = new OrganizationManagerStatic()
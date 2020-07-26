import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding'
import { Organization, OrganizationPatch } from '@stamhoofd/structures'

import { SessionManager } from '../../../../shared/networking'

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
        this.organization = response.data
    }
}

export const OrganizationManager = new OrganizationManagerStatic()
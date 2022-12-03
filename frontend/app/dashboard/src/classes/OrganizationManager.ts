import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding'
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { Toast } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { LoginHelper, Session, SessionManager } from '@stamhoofd/networking'
import { Organization, OrganizationAdmins, OrganizationPatch, STBillingStatus } from '@stamhoofd/structures'

import LoginView from '../views/login/LoginView.vue';

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

    async switchOrganization(component, organizationId: string) {
        if (document.activeElement) {
            // Blur currently focused element, to prevent from opening the login view multiple times
            (document.activeElement as HTMLElement).blur()
        }

        try {
            let session = await SessionManager.getSessionForOrganization(organizationId)
            if (!session) {
                session = new Session(organizationId)
                await session.loadFromStorage()
            }

            if (session.canGetCompleted()) {
                await SessionManager.setCurrentSession(session, false)
                if (!session.canGetCompleted() && !session.isComplete()) {
                    // Retry
                    await this.switchOrganization(component, organizationId)
                    return
                }
                return
            }

            // Load the organization
            try {
                await session.fetchOrganization(false)
            } catch (e) {
                if (Request.isNetworkError(e)) {
                    // ignore if we already have an organization
                    if (!session.organization) {
                        throw e;
                    }
                    // Show network warning only
                    Toast.fromError(e).show()
                } else {
                    throw e;
                }
            }

            if (session.organization) {
                // Update saved session (only if it was already added to the storage)
                SessionManager.addOrganizationToStorage(session.organization, {updateOnly: true}).catch(console.error)
            }

            // Switch locale to other country if needed
            if (session.organization) {
                I18nController.shared?.switchToLocale({ country: session.organization.address.country }).catch(console.error)
            }

            component.present(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(LoginView, { 
                    session 
                }) 
            }).setDisplayStyle("sheet"))
        } catch (e) {
            if (e.hasCode("invalid_organization")) {
                // Clear from session storage
                await SessionManager.removeOrganizationFromStorage(organizationId)
                throw new SimpleError({
                    code: "invalid_organization",
                    message: e.message,
                    human: "Deze vereniging bestaat niet (meer)"
                })
            }
            throw e;
        }
    }
}

export const OrganizationManager = new OrganizationManagerStatic()
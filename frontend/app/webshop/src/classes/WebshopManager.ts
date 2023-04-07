import { Decoder } from '@simonbackx/simple-encoding'
import { NetworkManager, SessionManager } from '@stamhoofd/networking'
import { Organization, Webshop } from '@stamhoofd/structures'

/**
 * Convenient access to the organization of the current session
 */
export class WebshopManagerStatic {
    organization!: Organization
    webshop!: Webshop

    /**
     * Doing authenticated requests
     */
    get server() {
        if (SessionManager.currentSession) {
            return SessionManager.currentSession.optionalAuthenticatedServer
        }
        const server = NetworkManager.server
        server.host = "https://" + this.organization.id + "." + STAMHOOFD.domains.api;
        return server
    }

    async reload() {
        const response = await NetworkManager.server.request({
            method: "GET",
            path: "/webshop/"+this.webshop.id,
            decoder: Webshop as Decoder<Webshop>
        })
        this.webshop = response.data
    }
}

export const WebshopManager = new WebshopManagerStatic()
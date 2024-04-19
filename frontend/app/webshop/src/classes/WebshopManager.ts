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
    get optionalAuthenticatedServer() {
        if (SessionManager.currentSession) {
            return SessionManager.currentSession.optionalAuthenticatedServer
        }
        return this.server
    }

    /**
     * Doing authenticated requests
     */
    get server() {
        const server = NetworkManager.server
        server.host = "https://" + this.organization.id + "." + STAMHOOFD.domains.api;
        return server
    }

    get unscopedServer() {
        return NetworkManager.server
    }

    async reload() {
        const response = await this.server.request({
            method: "GET",
            path: "/webshop/"+this.webshop.id,
            decoder: Webshop as Decoder<Webshop>
        })
        this.webshop = response.data
    }
}

export const WebshopManager = new WebshopManagerStatic()
import { NetworkManager } from '@stamhoofd/networking'
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
        const server = NetworkManager.server

        if (process.env.NODE_ENV == "production") {
            server.host = "https://" + this.organization.id + ".api.stamhoofd.app"
        } else {
            server.host = "https://" + this.organization.id + ".api.stamhoofd.dev"
        }

        return server
    }
}

export const WebshopManager = new WebshopManagerStatic()
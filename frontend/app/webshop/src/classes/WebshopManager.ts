import { Decoder } from '@simonbackx/simple-encoding'
import { NetworkManager, SessionContext, SessionManager } from '@stamhoofd/networking'
import { Organization, Webshop } from '@stamhoofd/structures'

/**
 * Convenient access to the organization of the current session
 */
export class WebshopManager {
    webshop!: Webshop
    $context: SessionContext

    get organization() {
        return this.$context.organization!
    }

    constructor($context: SessionContext, webshop: Webshop) {
        this.webshop = webshop
        this.$context = $context
    }

    /**
     * Doing authenticated requests
     */
    get optionalAuthenticatedServer() {
        return this.$context.optionalAuthenticatedServer
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
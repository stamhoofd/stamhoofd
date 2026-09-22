import type { Decoder } from '@simonbackx/simple-encoding';
import { ColorHelper } from '@stamhoofd/components/ColorHelper.ts';
import { setFavicon } from '@stamhoofd/components/helpers/favicon.ts';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Platform} from '@stamhoofd/structures';
import { DarkMode, Webshop } from '@stamhoofd/structures';

/**
 * Convenient access to the organization of the current session
 */
export class WebshopManager {
    webshop!: Webshop;
    $context: SessionContext;
    platform: Platform;

    get organization() {
        return this.$context.organization!;
    }

    constructor($context: SessionContext, platform: Platform, webshop: Webshop) {
        this.webshop = webshop;
        this.$context = $context;
        this.platform = platform;

        // Set color
        if (this.webshop.meta.color) {
            ColorHelper.setColor(this.webshop.meta.color);
        }
        else if (this.$context.organization?.meta.color) {
            ColorHelper.setColor(this.$context.organization?.meta.color);
        }
        else {
            if (this.platform.config.color) {
                ColorHelper.setColor(this.platform.config.color);
            }
        }
        ColorHelper.setDarkMode(this.webshop.meta.darkMode ?? DarkMode.Off);

        setFavicon(this.organization, this.webshop);
    }

    /**
     * Doing authenticated requests
     */
    get optionalAuthenticatedServer() {
        return this.$context.optionalAuthenticatedServer;
    }

    /**
     * Doing authenticated requests
     */
    get server() {
        const server = NetworkManager.server;
        server.host = 'https://' + this.organization.id + '.' + STAMHOOFD.domains.api;
        return server;
    }

    get unscopedServer() {
        return NetworkManager.server;
    }

    async reload() {
        const response = await this.optionalAuthenticatedServer.request({
            method: 'GET',
            path: '/webshop/' + this.webshop.id,
            decoder: Webshop as Decoder<Webshop>,
        });
        this.webshop = response.data;
    }
}

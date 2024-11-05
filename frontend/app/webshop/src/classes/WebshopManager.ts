import { Decoder } from '@simonbackx/simple-encoding';
import { ColorHelper } from '@stamhoofd/components';
import { NetworkManager, SessionContext } from '@stamhoofd/networking';
import { DarkMode, Webshop } from '@stamhoofd/structures';

/**
 * Convenient access to the organization of the current session
 */
export class WebshopManager {
    webshop!: Webshop;
    $context: SessionContext;

    get organization() {
        return this.$context.organization!;
    }

    constructor($context: SessionContext, webshop: Webshop) {
        this.webshop = webshop;
        this.$context = $context;

        // Set color
        if (this.webshop.meta.color) {
            ColorHelper.setColor(this.webshop.meta.color);
        }
        else if (this.$context.organization?.meta.color) {
            ColorHelper.setColor(this.$context.organization?.meta.color);
        }
        ColorHelper.setDarkMode(this.webshop.meta.darkMode ?? DarkMode.Off);

        this.setFavicon();
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
        const response = await this.server.request({
            method: 'GET',
            path: '/webshop/' + this.webshop.id,
            decoder: Webshop as Decoder<Webshop>,
        });
        this.webshop = response.data;
    }

    setFavicon() {
        if (!this.webshop.meta.squareLogo) {
            return;
        }

        const linkElement = document.querySelector("link[rel='icon']") as HTMLLinkElement;
        if (linkElement) {
            return;
        }

        const href = this.webshop.meta.squareLogo?.getPathForSize(256, 256);
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = href.endsWith('.svg') ? 'image/svg+xml' : (href.endsWith('.png') ? 'image/png' : 'image/jpeg');
        link.href = href;

        document.head.appendChild(link);
    }
}

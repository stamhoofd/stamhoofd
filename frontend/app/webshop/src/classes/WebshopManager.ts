import type { Decoder } from '@common/encoding';
import { ColorHelper } from '@stamhoofd/components/ColorHelper.ts';
import { setFavicon } from '@stamhoofd/components/helpers/favicon.ts';
import { forceWebshopOpenForPreview } from '@stamhoofd/components/webshops/webshopPreview.ts';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import type { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import type { Platform } from '@stamhoofd/structures';
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

    /**
     * Shown as a preview in the dashboard: the webshop comes from the dashboard, is always shown as open and nothing
     * can be ordered
     */
    preview: boolean;

    constructor($context: SessionContext, platform: Platform, webshop: Webshop, { preview = false }: { preview?: boolean } = {}) {
        this.webshop = preview ? forceWebshopOpenForPreview(webshop) : webshop;
        this.$context = $context;
        this.platform = platform;
        this.preview = preview;

        this.applyTheme();
        setFavicon(this.organization, this.webshop);
    }

    /**
     * Preview: the webshop with the settings in the dashboard that are not saved yet
     */
    setPreviewWebshop(webshop: Webshop) {
        this.webshop = forceWebshopOpenForPreview(webshop);
        this.applyTheme();
    }

    private applyTheme() {
        if (this.webshop.meta.color) {
            ColorHelper.setColor(this.webshop.meta.color);
        } else if (this.$context.organization?.meta.color) {
            ColorHelper.setColor(this.$context.organization?.meta.color);
        } else {
            if (this.platform.config.color) {
                ColorHelper.setColor(this.platform.config.color);
            }
        }
        ColorHelper.setDarkMode(this.webshop.meta.darkMode ?? DarkMode.Off);
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
        // The preview shows the webshop of the dashboard, with the settings that are not saved yet
        if (this.preview) {
            return;
        }
        const response = await this.optionalAuthenticatedServer.request({
            method: 'GET',
            path: '/webshop/' + this.webshop.id,
            decoder: Webshop as Decoder<Webshop>,
        });
        this.webshop = response.data;
    }
}

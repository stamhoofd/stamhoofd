import { ColorHelper } from '@stamhoofd/components/ColorHelper';
import { GlobalEventBus } from '@stamhoofd/components/EventBus';
import type { AppType, Platform } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { inject, toRef } from 'vue';
import type { SessionContext } from './SessionContext';

export function useThemeManager(): Ref<ThemeManager> {
    return toRef(inject<ThemeManager>('$themeManager', null as unknown as ThemeManager)) as any as Ref<ThemeManager>;
}

/**
 * Applies the corporate identity of the platform (color + favicon) to the document, and keeps it in
 * sync with the platform of the session context it is bound to.
 *
 * The platform itself is owned by the SessionContext: this only listens.
 */
export class ThemeManager {
    $context: SessionContext;
    $app: AppType | 'auto';

    private get $platform(): Platform {
        return this.$context.platform;
    }

    constructor($context: SessionContext, app: AppType | 'auto') {
        this.$context = $context;
        this.$app = app;

        // The context owns the platform, so it is the one that knows when it changed. React to that
        // instead of updating the styles at every call site that happens to change the platform.
        $context.addListener(this, (changed) => {
            if (changed !== 'platform') {
                return;
            }
            this.updateStyles();
            GlobalEventBus.sendEvent('platform-updated', this.$platform).catch(console.error);
        });

        this.updateStyles();
    }

    updateStyles() {
        // Set color
        if (this.$platform.config.color && this.$app !== 'webshop') {
            ColorHelper.setColor(this.$platform.config.color);
        }
        this.setFavicon();
    }

    setFavicon() {
        if (!this.$platform.config.squareLogo) {
            return;
        }
        if (this.$app === 'webshop') {
            return;
        }

        const linkElement = document.querySelector("link[rel='icon']") as HTMLLinkElement;
        if (linkElement) {
            return;
        }

        const href = this.$platform.config.squareLogo?.getPathForSize(256, 256);
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = href.endsWith('.svg') ? 'image/svg+xml' : (href.endsWith('.png') ? 'image/png' : 'image/jpeg');
        link.href = href;

        document.head.appendChild(link);
    }
}

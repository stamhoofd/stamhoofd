import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { ColorHelper } from '@stamhoofd/components/ColorHelper';
import { GlobalEventBus } from '@stamhoofd/components/EventBus';
import type { AppType } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PaginatedResponseDecoder, Platform, RegistrationPeriod, SortItemDirection } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { inject, toRef } from 'vue';
import { SessionContext } from './SessionContext';

export function usePlatformManager(): Ref<PlatformManager> {
    return toRef(inject<PlatformManager>('$platformManager', null as unknown as PlatformManager)) as any as Ref<PlatformManager>;
}

/**
 * Convenient access to the organization of the current session
 */
export class PlatformManager {
    $context: SessionContext;
    $app: AppType | 'auto';

    /**
     * The platform is owned by the session context: this is only a convenient shortcut
     */
    get $platform(): Platform {
        return this.$context.platform;
    }

    constructor($context: SessionContext, app: AppType | 'auto') {
        this.$context = $context;
        this.$app = app;

        // Only the app level platform manager may stamp the global Platform.shared.
        // The context never replaces the platform reference (updatePlatform uses deepSet),
        // so doing this once here keeps Platform.shared up to date forever.
        this.$platform.setShared();
        $context.clearAuthCache();

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

    /**
     * Create one from cache, otherwise load it using the network
     */
    static async createFromCache($context: SessionContext, app: AppType | 'auto', backgroundFetch = true): Promise<PlatformManager> {
        if (await $context.loadPlatformFromCache()) {
            const manager = new PlatformManager($context, app);

            if (backgroundFetch) {
                // We served a platform that came from storage, so refresh it in the background.
                manager.forceUpdate().catch(console.error);
            }

            return manager;
        }

        await $context.fetchPlatform();
        return new PlatformManager($context, app);
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

    static async fetchPlatform($context: SessionContext) {
        return await $context.fetchPlatform();
    }

    async forceUpdate() {
        await this.$context.fetchPlatform();
    }

    async patch(patch: AutoEncoderPatchType<Platform>, shouldRetry = false) {
        const response = await this.$context.authenticatedServer.request({
            method: 'PATCH',
            path: '/platform',
            body: patch,
            decoder: Platform as Decoder<Platform>,
            shouldRetry,
        });
        this.$context.updatePlatform(response.data);

        // Save platform in localstorage
        this.savePlatform().catch(console.error);
    }

    _pendingLoadPeriods: Promise<RegistrationPeriod[]> | null = null;

    async loadPeriods(force = false, shouldRetry?: boolean, owner?: any) {
        if (!force && this._pendingLoadPeriods && !this.$platform.periods) {
            await this._pendingLoadPeriods;
        }

        if (!force && this.$platform.periods) {
            return this.$platform.periods;
        }

        this._pendingLoadPeriods = (async () => {
            const response = await this.$context.optionalAuthenticatedServer.request({
                method: 'GET',
                path: '/registration-periods',
                query: new LimitedFilteredRequest({
                    limit: 100,
                    sort: [
                        {
                            key: 'startDate',
                            order: SortItemDirection.DESC,
                        },
                        {
                            key: 'id',
                            order: SortItemDirection.ASC,
                        },
                    ],
                }),
                decoder: new PaginatedResponseDecoder(
                    new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>),
                    LimitedFilteredRequest,
                ),
                owner,
                shouldRetry: shouldRetry ?? false,
            });
            const data = response.data.results;
            this.$platform.periods = data;
            return data;
        })();

        const awaited = await this._pendingLoadPeriods;
        this._pendingLoadPeriods = null;
        return awaited;
    }

    /**
     * Save organization in localstorage
     */
    async savePlatform() {
        await this.$context.savePlatform();
    }

    static async loadPlatform() {
        return await SessionContext.loadPlatformFromStorage();
    }
}

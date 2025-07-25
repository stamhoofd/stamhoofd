import { ArrayDecoder, AutoEncoderPatchType, Decoder, deepSetArray, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { ColorHelper, GlobalEventBus } from '@stamhoofd/components';
import { SessionContext, Storage } from '@stamhoofd/networking';
import { AppType, LimitedFilteredRequest, OrganizationAdmins, PaginatedResponseDecoder, Platform, RegistrationPeriod, SortItemDirection, UserWithMembers, Version } from '@stamhoofd/structures';
import { inject, reactive, Ref, toRef } from 'vue';

export function usePlatformManager(): Ref<PlatformManager> {
    return toRef(inject<PlatformManager>('$platformManager', null as unknown as PlatformManager)) as any as Ref<PlatformManager>;
}

/**
 * Convenient access to the organization of the current session
 */
export class PlatformManager {
    $context: SessionContext;
    $platform: Platform;
    $app: AppType | 'auto';

    constructor($context: SessionContext, $platform: Platform, app: AppType | 'auto') {
        this.$context = $context;
        this.$platform = $platform;
        this.$app = app;

        $platform.setShared();
        $context.clearAuthCache();

        this.updateStyles();
    }

    updateStyles() {
        // Set color
        if (this.$platform.config.color && this.$app !== 'webshop') {
            ColorHelper.setColor(this.$platform.config.color);
        }
        this.setFavicon();
    }

    static _lastFetch: Date | null = null;

    /**
     * Create one from cache, otherwise load it using the network
     */
    static async createFromCache($context: SessionContext, app: AppType | 'auto', backgroundFetch = true, requirePrivateConfig = false): Promise<PlatformManager> {
        const fromStorage = await PlatformManager.loadPlatform();

        // Users with global permissions need the private data to reliably calculate permissions, even for specific organizations when not using the admin panel
        requirePrivateConfig = requirePrivateConfig || $context.user?.permissions?.globalPermissions?.isEmpty === false;
        if ($context.user?.organizationId) {
            requirePrivateConfig = false;
        }

        if (fromStorage && (fromStorage.privateConfig || !requirePrivateConfig)) {
            const manager = new PlatformManager($context, reactive(fromStorage as any) as Platform, app);

            if (backgroundFetch && (this._lastFetch === null || (Date.now() - this._lastFetch.getTime()) > 1000 * 60)) {
                this._lastFetch = new Date();
                manager.forceUpdate().catch(console.error);
            }

            return manager;
        }

        const platform = reactive(await PlatformManager.fetchPlatform($context)) as any as Platform;
        const platformManager = new PlatformManager($context, platform, app);
        await platformManager.savePlatform();
        await GlobalEventBus.sendEvent('platform-updated', platformManager.$platform);
        return platformManager;
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
        const pResponse = await $context.optionalAuthenticatedServer.request({
            method: 'GET',
            path: '/platform',
            decoder: Platform as Decoder<Platform>,
        });
        this._lastFetch = new Date();
        return pResponse.data;
    }

    async forceUpdate() {
        this.$platform.deepSet(await PlatformManager.fetchPlatform(this.$context));
        this.updateStyles();
        await this.savePlatform();
        await GlobalEventBus.sendEvent('platform-updated', this.$platform);
    }

    async patch(patch: AutoEncoderPatchType<Platform>, shouldRetry = false) {
        const response = await this.$context.authenticatedServer.request({
            method: 'PATCH',
            path: '/platform',
            body: patch,
            decoder: Platform as Decoder<Platform>,
            shouldRetry,
        });

        // Keep admins
        const admins = this.$platform.admins;

        this.$platform.deepSet(response.data);

        if (admins && !response.data.admins && patch.admins) {
            this.$platform.admins = patch.admins.applyTo(admins);
        }
        else if (admins && !response.data.admins && !patch.admins) {
            this.$platform.admins = admins;
        }

        // Save platform in localstorage
        this.savePlatform().catch(console.error);
        this.updateStyles();
        await GlobalEventBus.sendEvent('platform-updated', this.$platform);
    }

    async loadAdmins(force = false, shouldRetry?: boolean, owner?: any): Promise<void> {
        if (!force && this.$platform.admins) {
            return;
        }

        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/platform/admins',
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>,
            shouldRetry: shouldRetry ?? false,
            owner,
        });

        if (this.$platform.admins) {
            deepSetArray(this.$platform.admins, response.data.users);
        }
        else {
            this.$platform.admins = response.data.users;
        }
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
        await Storage.keyValue.setItem('platform', JSON.stringify(new VersionBox(this.$platform).encode({ version: Version })));
    }

    static async loadPlatform() {
        try {
            const value = await Storage.keyValue.getItem('platform');
            if (!value) {
                return null;
            }
            const decoder = new VersionBoxDecoder(Platform as Decoder<Platform>);
            const result = decoder.decode(new ObjectData(JSON.parse(value), { version: 0 }));
            return result.data;
        }
        catch (e) {
            console.error(e);
            return null;
        }
    }
}

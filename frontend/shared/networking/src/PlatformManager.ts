import { ArrayDecoder, AutoEncoderPatchType, Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { SessionContext, Storage } from '@stamhoofd/networking';
import { Platform, User, Version } from '@stamhoofd/structures';
import { Ref, inject, reactive, toRef } from 'vue';

export function usePlatformManager(): Ref<PlatformManager> {
    return toRef(inject<PlatformManager>('$platformManager') as PlatformManager) as Ref<PlatformManager>
}

/**
 * Convenient access to the organization of the current session
 */
export class PlatformManager {
    $context: SessionContext
    $platform: Platform

    constructor($context: SessionContext, $platform: Platform) {
        this.$context = $context
        this.$platform = $platform

        $platform.setShared()
    }

    /**
     * Create one from cache, otherwise load it using the network
     */
    static async createFromCache($context: SessionContext, backgroundFetch = true, requirePrivateConfig = false): Promise<PlatformManager> {
        const fromStorage = await PlatformManager.loadPlatform()

        if (fromStorage && (fromStorage.privateConfig || !requirePrivateConfig)) {
            const manager = new PlatformManager($context, reactive(fromStorage as Platform) as Platform)

            if (backgroundFetch) {
                manager.forceUpdate().catch(console.error)
            }

            return manager
        }

        const platform = reactive(await PlatformManager.fetchPlatform($context)) as Platform
        const platformManager = new PlatformManager($context, platform)
        await platformManager.savePlatform()
        return platformManager;
    }

    static async fetchPlatform($context: SessionContext) {
        const pResponse = await $context.optionalAuthenticatedServer.request({
            method: 'GET',
            path: '/platform',
            decoder: Platform as Decoder<Platform>
        })
        return pResponse.data
    }

    async forceUpdate() {
        this.$platform.set(await PlatformManager.fetchPlatform(this.$context))
    }

    async patch(patch: AutoEncoderPatchType<Platform>, shouldRetry = false) {
        const response = await this.$context.authenticatedServer.request({
            method: "PATCH",
            path: "/platform",
            body: patch,
            decoder: Platform as Decoder<Platform>,
            shouldRetry
        })

        // Keep admins
        const admins = this.$platform.admins

        this.$platform.set(response.data)

        if (admins && !response.data.admins && patch.admins) {
            this.$platform.admins = patch.admins.applyTo(admins)
        } else if (admins && !response.data.admins && !patch.admins) {
            this.$platform.admins = admins
        }

        // Save platform in localstorage
        this.savePlatform().catch(console.error)
    }

    async loadAdmins(force = false, shouldRetry?: boolean, owner?: any): Promise<void> {
        if (!force && this.$platform.admins) {
            return
        }

        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/platform/admins',
            decoder: new ArrayDecoder(User as Decoder<User>),
            shouldRetry: shouldRetry ?? false,
            owner
        })

        this.$platform.admins = response.data
    }

    /**
     * Save organization in localstorage
     */
    async savePlatform() {
        await Storage.keyValue.setItem("platform", JSON.stringify(new VersionBox(this.$platform).encode({version: Version})))
    }

    static async loadPlatform() {
        try {
            const value = await Storage.keyValue.getItem("platform")
            if (!value) {
                return null;
            }
            const decoder = new VersionBoxDecoder(Platform as Decoder<Platform>)
            const result = decoder.decode(new ObjectData(JSON.parse(value), {version: 0}))
            return result.data
        } catch (e) {
            console.error(e);
            return null;
        }
    }
}

import { BundleInfo, CapacitorUpdater, DownloadChangeListener } from "@capgo/capacitor-updater"
import { AutoEncoder, Decoder, field, StringDecoder } from "@simonbackx/simple-encoding"
import { Server } from "@simonbackx/simple-networking"
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"
import { ModalStackEventBus, Toast, ToastButton } from "@stamhoofd/components"
import { Storage, UpdateOptions } from "@stamhoofd/networking"
import { sleep } from "@stamhoofd/utility"

import CheckUpdateView from "./CheckUpdateView.vue"

class Release extends AutoEncoder {
    @field({ decoder: StringDecoder })
        version: string

    @field({ decoder: StringDecoder })
        path: string
}

function compareVersions(current: string, other: string) {
    const currentParts = current.split('.')
    const otherParts = other.split('.')

    for (let i = 0; i < currentParts.length; i++) {
        const currentPart = parseInt(currentParts[i] ?? '0')
        const otherPart = parseInt(otherParts[i] ?? '0')

        if (currentPart > otherPart) {
            return -1
        } else if (currentPart < otherPart) {
            return 1
        }
    }
    return 0;
}


export class UpdateStatus {    
    /**
     * Hide the CheckUpdateView that was displayed (set by the CheckUpdateView)
     */
    private doHide: (() => void) | null = null
    progress: number | null = null

    status: 'checking' | 'downloading' | 'installing' = 'checking'

    options: UpdateOptions

    constructor(options: UpdateOptions = {}) {
        this.options = options
    }

    setDoHide(doHide: () => void) {
        this.doHide = doHide
    }

    async checkForUpdates(): Promise<Release|null> {
        this.status = 'checking'

        if (this.options.channel) {
            await Storage.keyValue.setItem("UPDATE_SERVER", this.options.channel)
        }
        const server = this.options.channel || await Storage.keyValue.getItem("UPDATE_SERVER")
        const url = new URL(this.options.channel || server || STAMHOOFD.APP_UPDATE_SERVER_URL)
        const host = url.protocol + "//" + url.host
        const checkPath = url.pathname

        const doServer = new Server(host)

    
        const latest = (await doServer.request({
            method: 'GET',
            path: checkPath,
            decoder: Release as Decoder<Release>,
            shouldRetry: false,
            timeout: this.options.checkTimeout || 3 * 1000
        })).data;

        if (!this.options.force && compareVersions(STAMHOOFD.VERSION, latest.version) <= 0) {
            return null;
        }

        return latest;
    }

    async downloadRelease(release: Release): Promise<BundleInfo> {
        this.status = 'downloading'

        // Check the latest bundle we already downloaded
        const {bundles} = await CapacitorUpdater.list()

        const alreadyDownloaded = this.options.force ? false : bundles.find(b => b.version === release.version.toString())
        
        let version: BundleInfo
        if (!alreadyDownloaded) {
            //toast = new Toast(`Downloaden van de nieuwste update (${STAMHOOFD.VERSION} > ${release.version})...`, 'spinner').setProgress(0).setHide(null).show()

            // check
            const listener: DownloadChangeListener = (v) => {
                this.progress = v.percent/100
            };

            try {
                await CapacitorUpdater.addListener('download', listener)
                version = await CapacitorUpdater.download({
                    url: release.path,
                    version: release.version.toString()
                })
            } catch (e) {
                CapacitorUpdater.removeAllListeners().catch(console.error)
                throw e;
            }
            await CapacitorUpdater.removeAllListeners()
            this.progress = 1
            //toast?.hide()
        } else {
            version = alreadyDownloaded
        }
        return version;
    }

    async installAndLoadVersion(version: BundleInfo) {
        this.status = 'installing'
        await CapacitorUpdater.set(version);
    }

    async installVersion(version: BundleInfo) {
        this.status = 'installing'

        // Set the version on next reload
        await CapacitorUpdater.next(version);

        new Toast(`Herlaad om de nieuwste update toe te passen`, 'download').setButton(new ToastButton('Herladen', () => {
            CapacitorUpdater.set(version).catch((e) => {
                Toast.fromError(e as Error).show()
            });
        })).setHide(null).show()
    }

    show() {
        ModalStackEventBus.sendEvent("present", {
            components: [
                new ComponentWithProperties(CheckUpdateView, {
                    status: this   
                })
            ],
            modalDisplayStyle: "cover",
            animated: false
        }).catch(console.error)
    }

    hide() {
        this.doHide?.()
        this.doHide = null
    }

    async start() {
        if (this.options.visibleCheck) {
            this.show()
        }

        try {
            const release = await this.checkForUpdates()

            if (!release) {
                // No update available
                this.hide()
                return;
            }

            if (this.options.visibleDownload && !this.options.visibleCheck) {
                this.show()
            }

            // Update available
            const version = await this.downloadRelease(release)
            
            // Install and reload (forced)
            if (this.options.installAutomatically) {
                await this.installAndLoadVersion(version)

                // Sleep a bit before resolving the promise (otherwise the app will assume it's already updated)
                await sleep(5000)
            } else {
                await this.installVersion(version)
            }
        } catch (e) {
            console.error(e);
            this.hide()

            if (this.options.customText) {
                // Don't show errors
                return
            }

            if (this.options.visibleCheck && this.status === 'checking') {
                new Toast("Er is een fout opgetreden bij het controleren op updates. Probeer het later opnieuw.", "error red").show()
            } else if (this.status === 'downloading' && (this.options.visibleCheck || this.options.visibleDownload)) {
                new Toast("Er is een fout opgetreden bij het downloaden van de update. Probeer het later opnieuw.", "error red").show()
            } else if (this.status === 'installing' && (this.options.visibleCheck || this.options.visibleDownload)) {
                new Toast("Er is een fout opgetreden bij het installeren van de update. Probeer het later opnieuw.", "error red").show()
            }
        }
    }
}
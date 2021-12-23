<template>
    <div class="st-view scanner-view">
        <STNavigationBar title="Scan een ticket" :show-title="true">
            <button slot="left" class="icon button close" @click="dismiss" />
        </STNavigationBar>

        <div class="video-container" :class="{ native: disableWebVideo }">
            <video v-if="!disableWebVideo" ref="video" />
            <div v-if="!disableWebVideo" class="scan-overlay" />

            <div class="video-footer">
                <div class="button-bar">
                    <button v-if="hasFlash" class="round-button" :class="{ selected: isFlashOn }" @click="toggleFlash">
                        <span class="icon flashlight" />
                    </button>
                    <button v-if="cameras.length > 1" class="round-button" @click="switchCamera">
                        <span class="icon reverse" />
                    </button>
                </div>

                <div class="status-bar">
                    <p v-if="isLoading">
                        <Spinner class="inline" /> Bijwerken...
                    </p>
                    <p v-else-if="hadNetworkError">
                        Geen internetverbinding. Scannen van tickets blijft gedeeltelijk werken. Internet is aan te raden.<br>
                        <span class="style-description-small">Laatst bijgewerkt: {{ lastUpdatedText }}</span><br>
                        <button class="button text" @click="updateTickets">
                            Opnieuw proberen
                        </button>
                    </p>
                    <p v-else>
                        <template v-if="disableWebVideo">
                            Plaats de QR-code in het midden van het scherm.
                        </template><template v-else>
                            Plaats de QR-code in het kader om te scannen.
                        </template><br>
                        <span class="style-description-small">Laatst bijgewerkt: {{ lastUpdatedText }}</span>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,Spinner,STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { AppManager } from "@stamhoofd/networking";
import { Order, OrderStatus, Product, TicketPrivate } from "@stamhoofd/structures";
import { sleep } from "@stamhoofd/utility";
// QR-scanner worker
import QrScanner from 'qr-scanner';
import { Component, Mixins, Prop } from "vue-property-decorator";

import QrScannerWorkerPath from '!!file-loader!qr-scanner/qr-scanner-worker.min.js';

import { WebshopManager } from "../WebshopManager";
import TicketAlreadyScannedView from "./status/TicketAlreadyScannedView.vue";
import ValidTicketView from "./status/ValidTicketView.vue";

//if you have another AudioContext class use that one, as some browsers have a limit
var audioCtx = new (window.AudioContext || (window as any).webkitAudioContext || (window as any).audioContext);

//All arguments are optional:

//duration of the tone in milliseconds. Default is 500
//frequency of the tone in hertz. default is 440
//volume of the tone. Default is 1, off is 0.
//type of tone. Possible values are sine, square, sawtooth, triangle, and custom. Default is sine.
//callback to use on end of tone
function beep(duration, frequency, volume, type, callback) {
    var oscillator = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (volume){gainNode.gain.value = volume;}
    if (frequency){oscillator.frequency.value = frequency;}
    if (type){oscillator.type = type;}
    if (callback){oscillator.onended = callback;}

    oscillator.start(audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 1.5, audioCtx.currentTime + ((duration || 500) / 1000)
    )
    gainNode.gain.exponentialRampToValueAtTime(
        0.00001, audioCtx.currentTime + ((duration || 500) / 1000)
    )
    oscillator.stop(audioCtx.currentTime + ((duration || 500) / 1000));
    
}

@Component({
    components: {
        STNavigationBar,
        BackButton,
        STList,
        STListItem,
        STToolbar,
        Spinner,
        Checkbox
    }
})
export default class TicketScannerView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    webshopManager!: WebshopManager

    @Prop({ required: true })
    disabledProducts: Product[]

    checkingTicket = false

    // Disable scanning before this date
    cooldown: Date | null = null
    cooldownResult: string | null = null

    cameras: MediaDeviceInfo[] = []
    cameraIndex = 0
    hasFlash = false
    isFlashOn = false
    stream: MediaStream | null = null

    pollInterval: number | null = null

    hadNetworkError = false

    currentDate = new Date()
    updateCurrentDateInterval: number | null = null

    disableWebVideo = false

    nativeListener?: any

    get isLoading() {
        return this.webshopManager.isLoadingOrders || this.webshopManager.isLoadingTickets
    }

    get lastUpdatedText() {
        const min = Math.min(this.webshopManager.lastUpdatedTickets?.getTime() ?? 0, this.webshopManager.lastUpdatedOrders?.getTime() ?? 0)
        if (min === 0) {
            return "nooit"
        }
        const now = this.currentDate.getTime()
        let diff = now - min

        const days = Math.floor(diff / (60*1000*60*24))
        
        diff = diff % (60*1000*60*24)
        const hours = Math.floor(diff / (60*1000*60))
        diff = diff % (60*1000*60)

        const minutes = Math.floor(diff / (60*1000))

        if (days > 0) {
            if (days === 1) {
                return "één dag geleden"
            }
            return days+" dagen geleden"
        }

        if (hours > 0) {
            if (hours === 1) {
                return "één uur geleden"
            }
            return hours+" uur geleden"
        }

        if (minutes > 0) {
            if (minutes === 1) {
                return "één minuut geleden"
            }
            return minutes+" minuten geleden"
        }

        return "zojuist"
    }

    switchCamera() {
        this.cameraIndex++
        if (this.cameraIndex > this.cameras.length - 1) {
            this.cameraIndex = 0
        }
        console.log(this.cameraIndex)
        //this.scanner?.setCamera(this.cameras[this.cameraIndex].id)

        this.setStream({ 
            video: { deviceId: this.cameras[this.cameraIndex].deviceId },
            audio: false,
        }, true).catch(console.error)
    }

    toggleFlash() {
        if (AppManager.shared.QRScanner) {
            AppManager.shared.QRScanner.toggleTorch().then(torch => {
                console.log(torch)
                this.isFlashOn = torch.status
            }).catch(console.error)
            return
        }

        if (this.isFlashOn) {
            //this.scanner?.turnFlashOff()
            this.isFlashOn = false
        } else {
            //this.scanner?.turnFlashOn()
            this.isFlashOn = true
        }
    }


    async updateTickets() {
        try {
            await Promise.all([
                this.webshopManager.fetchNewTickets(false, false),
                this.webshopManager.fetchNewOrders(false, false)
            ])
            
            this.hadNetworkError = false

            // Do we still have some missing patches that are not yet synced with the server?
            this.webshopManager.trySavePatches().catch(console.error)
        } catch (e) {
            if (Request.isNetworkError(e)) {
                this.hadNetworkError = true
            } else {
                Toast.fromError(e).show()
            }
        }
    }

    readingQR = false
    canvas = document.createElement('canvas')

    pollImage() {
        if (this.checkingTicket || this.readingQR) {
            // Skip. Already working.
            return
        }

        this.readingQR = true

        const video = this.$refs.video as HTMLVideoElement

        const w = video.offsetWidth
        const h = video.offsetHeight

        const scale = 4/5
        const size = w*scale

        QrScanner.scanImage(video, {
            x: (w - size)/2,
            y: (h - size)/2,
            width: size,
            height: size
        }, undefined, this.canvas) // reusing the worker randomly breaks on ios after a certain amount of scans, so currently not using it ? :/
            .then(result => {
                this.readingQR = false
                this.validateQR(result)
            })
            .catch(() => {
                // ignore
                this.readingQR = false
            });
    }

    validateQR(result: string) {
        console.log("QR-code result: "+result)
        if (this.checkingTicket || (this.cooldown && this.cooldownResult == result && this.cooldown > new Date()) || !result) {
            // Skip. Already working.
            return
        }

        console.log("Processing result: "+result)

        // Wait 2 seconds before rescanning
        this.cooldown = new Date(new Date().getTime() + 2 * 1000)
        this.cooldownResult = result

        // Go a QR-code with value: result
        this.checkingTicket = true
        this.checkTicket(result).then(() => { 
            this.checkingTicket = false 
        }).catch(console.error)
    }

    stopStream() {
        if (!this.stream) {
            return
        }

        try {
            // Old browsers use old deprecated stop api on stream
            if (this.stream && (this.stream as any).stop) {
                (this.stream as any).stop();
                this.stream = null;
            } else {
                if (this.stream && this.stream.getTracks) {
                    var track = this.stream.getTracks()[0]; // if only one media track
                    track.stop();
                    this.stream = null;
                }
            }
        } catch (e) {
            console.error(e)
        }
    }

    async setStream(constraints: MediaStreamConstraints, force = false) {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }
        const video = this.$refs.video as HTMLVideoElement
        // iOS fix
        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');

        if (this.stream && this.stream.active && !force) {
            // Keep existing stream
            video.srcObject = this.stream;
        } else {
            this.stopStream()
            // Not adding `{ audio: true }` since we only want video now
            const stream = await navigator.mediaDevices
                .getUserMedia(constraints)
            this.stream = stream
            video.srcObject = stream;
        }
        video.play().catch(console.error);
        this.pollInterval = window.setInterval(this.pollImage, 300)

        // Only request camera's after we got permission
        this.cameras = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput")
        console.log("Camera's", this.cameras)

        try {
            const deviceId = this.stream.getVideoTracks()[0].getSettings().deviceId
            const index = this.cameras.findIndex(c => c.deviceId === deviceId)
            if (index != -1) {
                this.cameraIndex = index
                console.log("Found camera index ", index)
            }
        } catch (e) {
            console.error(e)
        }
    }

    async checkTicket(result: string) {
        if (!result.startsWith("https://")) {
            // Invalid ticket
            console.error("Not a url")
            this.invalidTicket();
            return
        }


        const parts = result.split("/")
        let next = false
        let secret: string | null = null

        for (const part of parts) {
            if (next && part !== "tickets") {
                secret = part
                break
            }
            if (part === "tickets") {
                next = true
            }
        }

        if (!secret) {
            console.error("No secret found")
            this.invalidTicket();
            return
        }

        // Fetch ticket from database
        try {
            const ticket = await this.webshopManager.getTicketFromDatabase(secret)
            if (ticket) {
                const order = await this.webshopManager.getOrderFromDatabase(ticket.orderId)
                if (!order) {
                    AppManager.shared.hapticError() 
                    new Toast("Er ging iets mis. Dit is een geldig ticket, maar de bijhorende bestelling kon niet geladen worden. Waarschijnlijk heb je tijdelijk internet nodig om nieuwe bestellingen op te halen. Probeer daarna opnieuw.", "error red").show()
                } else {

                    if (ticket.itemId !== null) {
                        const item = order.data.cart.items.find(i => i.id === ticket.itemId)
                        if (item) {
                            const product = this.disabledProducts.find(p => p.id === item.product.id)
                            if (product) {
                                this.disabledTicket(product, ticket.scannedAt)
                                return
                            }
                        }
                    }

                    if (order.status === OrderStatus.Canceled && order.status === OrderStatus.Deleted) {
                        this.canceledTicket()
                    } else if (ticket.scannedAt !== null) {
                        this.alreadyScannedTicket(ticket, order)
                    } else {
                        this.validTicket(ticket, order)
                    }
                }

            } else {
                console.error("Ticket not found")
                this.invalidTicket()
            }
        } catch (e) {
            console.error(e)
            // database error
            Toast.fromError(e).show()

            AppManager.shared.hapticError() 
        }
    }

    alreadyScannedTicket(ticket: TicketPrivate, order: Order) {
        AppManager.shared.hapticWarning() 

        // Disable scanning same one for 2 seconds
        this.cooldown = new Date(new Date().getTime() + 2 * 1000)

        this.show(new ComponentWithProperties(TicketAlreadyScannedView, {
            webshopManager: this.webshopManager,
            ticket,
            order
        }))
    }

    validTicket(ticket: TicketPrivate, order: Order) {
        AppManager.shared.hapticSuccess() 

        // Disable scanning same one for 2 seconds
        this.cooldown = new Date(new Date().getTime() + 2 * 1000)

        this.show(new ComponentWithProperties(ValidTicketView, {
            webshopManager: this.webshopManager,
            ticket,
            order
        }))
    }

    canceledTicket() {
        new Toast("Oeps! Dit ticket werd geannuleerd en is dus niet geldig.", "error red").show()
        AppManager.shared.hapticError() 
    }

    disabledTicket(product: Product, scannedAt: Date | null) {
        // todo: show invalid ticket
        new Toast("Dit is een ticket voor: "+product.name+(scannedAt ? ", en werd bovendien al eens gescand." : ""), "error red").show()
        AppManager.shared.hapticError() 
    }

    invalidTicket() {
        // todo: show invalid ticket
        new Toast("Ongeldig ticket", "error red").show()
        AppManager.shared.hapticError() 
    }

    async startScanning() {
        if (AppManager.shared.QRScanner) {
            // Make document transparent
            
            // Start (if still needed)
            try {
                await AppManager.shared.QRScanner.startScanning()
            } catch (e) {
                if (e.message && typeof e.message === "string" && e.message.includes("Permission")) {
                    new Toast("Geen toegang tot jouw camera. Ga naar de instellingen app om terug toegang te geven.", 'error red').show()
                    return
                }
                Toast.fromError(e).show()
                return
            }

            // Delay (wait for transition)
            await sleep(300)

            // Use native QRScanner
            this.disableWebVideo = true

            // Make background transparent to see the video underlay
            document.body.style.background = "transparent";
            (this.$el as HTMLElement).style.background = "transparent"

            // Disable scrolling (bouncing)
            document.body.style.overflow = "hidden"

            if (!this.nativeListener) {
                this.nativeListener = await AppManager.shared.QRScanner.addListener("scannedQRCode", (result: { value: string }) => {
                    this.validateQR(result.value)
                })
            }

            try {
                const torch = await AppManager.shared.QRScanner.getTorch()
                console.log(torch)
                this.isFlashOn = torch.status
                this.hasFlash = true
            } catch (e) {
                console.error(e)
            }

            return
        }

        QrScanner.WORKER_PATH = QrScannerWorkerPath;

        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }

        // Get access to the camera!
        if (navigator.mediaDevices) {
            await this.setStream(
                this.cameras.length > 0 ? {
                    video: { deviceId: this.cameras[this.cameraIndex].deviceId },
                    audio: false,
                } :
                    { 
                        video: { facingMode: "environment" },
                        audio: false,
                    })
        }
        
        /*this.scanner = new QrScanner(this.$refs.video as HTMLVideoElement, (result) => {
            

        }, undefined, undefined, "environment");
        await this.scanner.start()*/

        /*this.hasFlash = await this.scanner.hasFlash()
        console.log('has flash', this.hasFlash)
        this.isFlashOn = this.scanner.isFlashOn()*/
    }

    stopScanning() {
        if (AppManager.shared.QRScanner) {
            // remove other listeners
            if (this.nativeListener) {
                this.nativeListener.remove()
                this.nativeListener = undefined
            }

            // Use native QRScanner
            this.disableWebVideo = false

            // Reset body
            document.body.style.background = ""
            document.body.style.overflow = "";
            (this.$el as HTMLElement).style.background = ""

            AppManager.shared.QRScanner.stopScanning().catch(console.error)
            return
        }

        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }

        if (this.updateCurrentDateInterval) {
            clearInterval(this.updateCurrentDateInterval)
            this.updateCurrentDateInterval = null
        }

        // Kill stream
        this.stopStream()
    }

    pauseScanning() {
        if (AppManager.shared.QRScanner) {
            // remove other listeners
            if (this.nativeListener) {
                this.nativeListener.remove()
                this.nativeListener = undefined
            }

            // Use native QRScanner
            //this.disableWebVideo = false

            // Reset body overflow only
            //document.body.style.background = ""
            document.body.style.overflow = ""
            return
        }

        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }
        // We keep stream alive to prevent slow start / delays / permission dialogs

        if (this.updateCurrentDateInterval) {
            clearInterval(this.updateCurrentDateInterval)
            this.updateCurrentDateInterval = null
        }
    }

    deactivated() {
        this.pauseScanning()
    }

    activated() {
        // Prevent scanning previous one for 2 seconds
        this.cooldown = new Date(new Date().getTime() + 2 * 1000)

        // We restart the scanner every time because there is a bug in the qr scanner
        // that randomly breaks the scanning after some time when going back (recreating the video element)
        this.startScanning().catch(console.error)

        if (this.updateCurrentDateInterval) {
            clearInterval(this.updateCurrentDateInterval)
        }
        this.updateCurrentDateInterval = window.setInterval(() => {
            this.currentDate = new Date()
            if (!this.isLoading) {
                this.updateTickets().catch(console.error)
            }
        }, 1000*30)

        if (!this.isLoading) {
            this.updateTickets().catch(console.error)
        }
    }

    beforeDestroy() {
        this.stopScanning()
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.scanner-view {
    --st-vertical-padding: 0px;

    .video-container {
        flex-grow: 1;
        position: relative;
        margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
        background: black;

        video {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .scan-overlay {
            width: 70%;
            position: absolute;
            left: 50%;
            top: 50%;
            padding-bottom: 70%;
            border: 4px solid white;
            border-radius: 5px;
            transform: translate(-50%, -50%);
        }

        &.native {
            background: transparent;

            > video {
                display: none;
            }

            // Scan overlay should be centered relative to the whole view, because the scan view is underneath
            .scan-overlay {
                position: fixed;
            }
        }
    }

    .video-footer {
        position: absolute;
        left: 0;
        bottom: 0;
        right: 0;
        margin-bottom: calc(-1 * var(--st-safe-area-bottom, 0px));

        > .status-bar {
            min-height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: $color-background;
            padding: 15px 15px;
            text-align: center;
            color: $color-dark;
            font-size: 14px;
            line-height: 1.4;

            padding-bottom: calc(var(--st-safe-area-bottom, 0px) + 15px);

            .spinner-container {
                margin-right: 15px;
            }
        }
    }

    .button-bar {
        padding: 15px;
        text-align: right;
    }

    .round-button {
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        user-select: none;
        cursor: pointer;
        color: inherit;

        background: $color-dark;
        width: 48px;
        height: 48px;
        line-height: 48px;
        text-align: center;
        display: inline-block;
        color: $color-white;
        border-radius: 24px;
        transition: background-color 0.2s;

        &:active {
            background: $color-gray-1;
            transition: background-color 0s;
        }

        &.selected {
            background: $color-primary;

            &:active {
                background: $color-dark;
            }
        }
    }
    
}
</style>
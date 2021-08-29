<template>
    <div class="st-view scanner-view">
        <STNavigationBar title="Scan een ticket" :show-title="true">
            <button slot="left" class="icon button close" @click="dismiss" />
        </STNavigationBar>

        <div class="video-container">
            <video ref="video" />
            <div class="scan-overlay" />

            <div class="video-footer">
                <div class="button-bar">
                    <button v-if="hasFlash" class="round-button" :class="{ selected: isFlashOn }" @click="toggleFlash">
                        <span class="icon flashlight" />
                    </button>
                    <button v-if="cameras.length > 1" class="round-button" @click="switchCamera">
                        <span class="icon reverse" />
                    </button>
                </div>

                <div v-if="false" class="status-bar">
                    <p v-if="checkingTicket" slot="right">
                        Ticket controleren...
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,Spinner,STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { Order, Product, TicketPrivate } from "@stamhoofd/structures";
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

    pollInterval: number | null = null

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
        }).catch(console.error)
    }

    toggleFlash() {
        if (this.isFlashOn) {
            //this.scanner?.turnFlashOff()
            this.isFlashOn = false
        } else {
            //this.scanner?.turnFlashOn()
            this.isFlashOn = true
        }
    }

    mounted() {
        // Check for new tickets
        // todo: keep polling in the future
        this.webshopManager.fetchNewTickets(true, false).catch(console.error)
        this.webshopManager.fetchNewOrders(true, false).catch(console.error)

        // Do we still have some missing patches that are not yet synced with the server?
        this.webshopManager.trySavePatches().catch(console.error)
        //this.start().catch(console.error)
    }

    readingQR = false

    pollImage() {
        if (this.checkingTicket || this.readingQR) {
            // Skip. Already working.
            return
        }

        this.readingQR = true

        QrScanner.scanImage(this.$refs.video as HTMLVideoElement)
            .then(result => {
                this.readingQR = false
                console.log("QR-code result: "+result)
                if (this.checkingTicket || (this.cooldown && this.cooldownResult == result && this.cooldown > new Date()) || !result) {
                    // Skip. Already working.
                    return
                }

                // Wait 2 seconds before rescanning
                this.cooldown = new Date(new Date().getTime() + 2 * 1000)
                this.cooldownResult = result

                // Go a QR-code with value: result
                this.checkTicket(result).catch(console.error)
            })
            .catch(error => {
                // ignore
                this.readingQR = false
            });
    }

    async setStream(constraints: MediaStreamConstraints) {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }

        const video = this.$refs.video as HTMLVideoElement

        // iOS fix
        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');

        // Not adding `{ audio: true }` since we only want video now
        const stream = await navigator.mediaDevices
            .getUserMedia(constraints)
        video.srcObject = stream;
        video.play().catch(console.error);

        this.pollInterval = window.setInterval(this.pollImage, 500)

        // Only request camera's after we got permission
        this.cameras = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput")
        console.log("Camera's", this.cameras)

        try {
            const deviceId = stream.getVideoTracks()[0].getSettings().deviceId
            const index = this.cameras.findIndex(c => c.deviceId === deviceId)
            if (index != -1) {
                this.cameraIndex = index
                console.log("Found camera index ", index)
            }
        } catch (e) {
            console.error(e)
        }
    }

    async start() {
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

    async checkTicket(result: string) {

        if (!result.startsWith("https://")) {
            // Invalid ticket
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
            this.invalidTicket();
            return
        }

        this.checkingTicket = true

        // Fetch ticket from database
        try {
            const ticket = await this.webshopManager.getTicketFromDatabase(secret)
            if (ticket) {
                const order = await this.webshopManager.getOrderFromDatabase(ticket.orderId)
                if (!order) {
                    if (window.navigator.vibrate) {
                        window.navigator.vibrate([100, 100, 100]);
                    }
                    new Toast("Er ging iets mis. Dit is een geldig ticket, maar de bijhorende bestelling kon niet geladen worden. Waarschijnlijk heb je tijdelijk internet nodig om nieuwe bestellingen op te halen. Probeer daarna opnieuw.", "error red").show()
                } else {

                    if (ticket.itemId !== null) {
                        const item = order.data.cart.items.find(i => i.id === ticket.itemId)
                        if (item) {
                            const product = this.disabledProducts.find(p => p.id === item.product.id)
                            if (product) {
                                this.disabledTicket(product, ticket.scannedAt)
                                this.checkingTicket = false
                                return
                            }
                        }
                    }
                    if (ticket.scannedAt !== null) {
                        this.alreadyScannedTicket(ticket, order)
                    } else {
                        this.validTicket(ticket, order)
                    }
                }

            } else {
                this.invalidTicket()
            }
        } catch (e) {
            console.error(e)
            // database error
            Toast.fromError(e).show()

            if (window.navigator.vibrate) {
                window.navigator.vibrate([100, 100, 100]);
            }
        }

        this.checkingTicket = false
    }

    alreadyScannedTicket(ticket: TicketPrivate, order: Order) {
        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 100, 100]);
        }

        // Disable scanning same one for 2 seconds
        this.cooldown = new Date(new Date().getTime() + 2 * 1000)

        this.show(new ComponentWithProperties(TicketAlreadyScannedView, {
            webshopManager: this.webshopManager,
            ticket,
            order
        }))
    }

    validTicket(ticket: TicketPrivate, order: Order) {
        if (window.navigator.vibrate) {
            window.navigator.vibrate(100);
        }

        // Disable scanning same one for 2 seconds
        this.cooldown = new Date(new Date().getTime() + 2 * 1000)

        this.show(new ComponentWithProperties(ValidTicketView, {
            webshopManager: this.webshopManager,
            ticket,
            order
        }))
    }

    disabledTicket(product: Product, scannedAt: Date | null) {
        // todo: show invalid ticket
        new Toast("Dit is een ticket voor: "+product.name+(scannedAt ? ", en werd bovendien al eens gescand." : ""), "error red").show()

        if (window.navigator.vibrate) {
            // Vibrate twice
            window.navigator.vibrate([100, 100, 100]);
        }
    }

    invalidTicket() {
        // todo: show invalid ticket
        new Toast("Ongeldig ticket", "error red").show()

        if (window.navigator.vibrate) {
            // Vibrate twice
            window.navigator.vibrate([100, 100, 100]);
        }
    }

    deactivated() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }
    }

    activated() {
        // Prevent scanning previous one for 3 seconds
        this.cooldown = new Date(new Date().getTime() + 3 * 1000)

        // We restart the scanner every time because there is a bug in the qr scanner
        // that randomly breaks the scanning after some time when going back (recreating the video element)
        this.start().catch(console.error)
    }

    beforeDestroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }
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
            width: 2/3*100%;
            position: absolute;
            left: 50%;
            top: 50%;
            padding-bottom: 2/3*100%;
            border: 4px solid white;
            transform: translate(-50%, -50%);
        }
    }

    .video-footer {
        position: absolute;
        left: 0;
        bottom: 0;
        right: 0;

        > .status-bar {
            background: white;
            padding: 15px;
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
            background: $color-gray;
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
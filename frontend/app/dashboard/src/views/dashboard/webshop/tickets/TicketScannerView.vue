<template>
    <div ref="rootRef" class="st-view scanner-view">
        <STNavigationBar :show-title="true" :title="$t(`8578c5a9-1246-4c57-b1d4-65919a69a2bc`)">
            <template #left>
                <button class="icon button close" type="button" @click="() => dismiss()" />
            </template>
        </STNavigationBar>

        <div class="video-container" :class="{ native: disableWebVideo }">
            <video v-if="!disableWebVideo" ref="videoRef" />
            <div v-if="!disableWebVideo" class="scan-overlay" />

            <div class="video-footer">
                <div class="button-bar">
                    <button v-if="hasFlash" class="round-button" :class="{ selected: isFlashOn }" type="button" @click="toggleFlash">
                        <span class="icon flashlight" />
                    </button>
                    <button v-if="cameras.length > 1" class="round-button" type="button" @click="switchCamera">
                        <span class="icon reverse" />
                    </button>
                </div>

                <div class="status-bar">
                    <p v-if="isLoading">
                        <Spinner class="inline" /> {{ $t('547d2798-f0b0-4cdf-95cd-58f3bc6ab4e9') }}
                    </p>
                    <p v-else-if="hadNetworkError">
                        {{ $t('711b7638-be3d-4723-821e-cedef94c8782') }}<br><span class="style-description-small">{{ $t('5c9f4609-ebf3-44eb-bf7a-06399a87fc90') }} {{ lastUpdatedText }}</span><br><button class="button text" type="button" @click="updateTickets">
                            {{ $t('bccb094f-12eb-40d0-9a24-843832b0cdb7') }}
                        </button>
                    </p>
                    <p v-else>
                        <template v-if="disableWebVideo">
                            {{ $t('8f609412-7a05-461c-9819-54263bad0f43') }}
                        </template><template v-else>
                            {{ $t('40fe6e19-794f-439d-929e-d0c6c9f2f7be') }}
                        </template><br><span class="style-description-small">{{ $t('5c9f4609-ebf3-44eb-bf7a-06399a87fc90') }} {{ lastUpdatedText }}</span>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import { Spinner, STNavigationBar, Toast } from '@stamhoofd/components';
import { AppManager, PluginListenerHandle } from '@stamhoofd/networking';
import { Order, OrderStatus, PrivateOrder, Product, TicketPrivate } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';
// QR-scanner worker
import QrScanner from 'qr-scanner';

import { computed, onActivated, onBeforeUnmount, onDeactivated, ref } from 'vue';
import { WebshopManager } from '../WebshopManager';
import TicketAlreadyScannedView from './status/TicketAlreadyScannedView.vue';
import ValidTicketView from './status/ValidTicketView.vue';

// if you have another AudioContext class use that one, as some browsers have a limit
// var audioCtx = new (window.AudioContext || (window as any).webkitAudioContext || (window as any).audioContext)();

// All arguments are optional:

// duration of the tone in milliseconds. Default is 500
// frequency of the tone in hertz. default is 440
// volume of the tone. Default is 1, off is 0.
// type of tone. Possible values are sine, square, sawtooth, triangle, and custom. Default is sine.
// callback to use on end of tone
// function beep(duration: number, frequency: number, volume: number, type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom', callback: ((this: AudioScheduledSourceNode, ev: Event) => any) | null) {
//     var oscillator = audioCtx.createOscillator();
//     var gainNode = audioCtx.createGain();

//     oscillator.connect(gainNode);
//     gainNode.connect(audioCtx.destination);

//     if (volume) { gainNode.gain.value = volume; }
//     if (frequency) { oscillator.frequency.value = frequency; }
//     if (type) { oscillator.type = type; }
//     if (callback) { oscillator.onended = callback; }

//     oscillator.start(audioCtx.currentTime);
//     oscillator.frequency.exponentialRampToValueAtTime(
//         frequency * 1.5, audioCtx.currentTime + ((duration || 500) / 1000),
//     );
//     gainNode.gain.exponentialRampToValueAtTime(
//         0.00001, audioCtx.currentTime + ((duration || 500) / 1000),
//     );
//     oscillator.stop(audioCtx.currentTime + ((duration || 500) / 1000));
// }

const props = defineProps<{
    webshopManager: WebshopManager;
    disabledProducts: Product[];
}>();

const dismiss = useDismiss();
const show = useShow();

const videoRef = ref<HTMLVideoElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);

const checkingTicket = ref(false);
// Disable scanning before this dat
const cooldown = ref<Date | null>(null);
const cooldownResult = ref<string | null>(null);
const cameras = ref<MediaDeviceInfo[]>([]);
const cameraIndex = ref(0);
const hasFlash = ref(false);
const isFlashOn = ref(false);
const stream = ref<MediaStream | null>(null);

const pollInterval = ref<number | null>(null);

const hadNetworkError = ref(false);

const currentDate = ref<Date>(new Date());
const updateCurrentDateInterval = ref<number | null>(null);

const disableWebVideo = ref(false);

let nativeListener: PluginListenerHandle | null = null;

const isLoading = computed(() => props.webshopManager.orders.isFetching || props.webshopManager.tickets.isFetching);

const lastUpdatedText = computed(() => {
    const min = Math.min(props.webshopManager.tickets.lastUpdated?.getTime() ?? 0, props.webshopManager.orders.lastUpdated?.getTime() ?? 0);
    if (min === 0) {
        return 'nooit';
    }
    const now = currentDate.value.getTime();
    let diff = now - min;

    const days = Math.floor(diff / (60 * 1000 * 60 * 24));

    diff = diff % (60 * 1000 * 60 * 24);
    const hours = Math.floor(diff / (60 * 1000 * 60));
    diff = diff % (60 * 1000 * 60);

    const minutes = Math.floor(diff / (60 * 1000));

    if (days > 0) {
        if (days === 1) {
            return 'één dag geleden';
        }
        return days + ' dagen geleden';
    }

    if (hours > 0) {
        if (hours === 1) {
            return 'één uur geleden';
        }
        return hours + ' uur geleden';
    }

    if (minutes > 0) {
        if (minutes === 1) {
            return 'één minuut geleden';
        }
        return minutes + ' minuten geleden';
    }

    return 'zojuist';
});

function switchCamera() {
    cameraIndex.value += 1;
    if (cameraIndex.value > cameras.value.length - 1) {
        cameraIndex.value = 0;
    }
    console.log(cameraIndex.value);
    // this.scanner?.setCamera(cameras.value[cameraIndex.value].id)

    setStream({
        video: { deviceId: cameras.value[cameraIndex.value].deviceId },
        audio: false,
    }, true).catch(console.error);
}

function toggleFlash() {
    if (AppManager.shared.QRScanner) {
        AppManager.shared.QRScanner.toggleTorch().then((torch) => {
            console.log(torch);
            isFlashOn.value = torch.status;
        }).catch(console.error);
        return;
    }

    if (isFlashOn.value) {
        // this.scanner?.turnFlashOff()
        isFlashOn.value = false;
    }
    else {
        // this.scanner?.turnFlashOn()
        isFlashOn.value = true;
    }
}

async function updateTickets() {
    try {
        await Promise.all([
            props.webshopManager.tickets.fetchAllUpdated(),
            props.webshopManager.orders.fetchAllUpdated(),
        ]);

        hadNetworkError.value = false;

        // Do we still have some missing patches that are not yet synced with the server?
        props.webshopManager.tickets.trySavePatches().catch((e: any) => {
            console.error(e);
            Toast.fromError(e).show();
        });
    }
    catch (e: any) {
        if (Request.isNetworkError(e as Error)) {
            hadNetworkError.value = true;
        }
        else {
            Toast.fromError(e).show();
        }
    }
}

let readingQR = false;
const canvas = document.createElement('canvas');

function pollImage() {
    if (videoRef.value === null) {
        return;
    }

    if (checkingTicket.value || readingQR) {
        // Skip. Already working.
        return;
    }

    readingQR = true;

    const video = videoRef.value;

    const w = video.offsetWidth;
    const h = video.offsetHeight;

    const scale = 4 / 5;
    const size = w * scale;

    QrScanner.scanImage(video, {
        x: (w - size) / 2,
        y: (h - size) / 2,
        width: size,
        height: size,
    }, undefined, canvas) // reusing the worker randomly breaks on ios after a certain amount of scans, so currently not using it ? :/
        .then((result) => {
            readingQR = false;
            validateQR(result);
        })
        .catch(() => {
            // ignore
            readingQR = false;
        });
}

function validateQR(result: string) {
    console.log('QR-code result: ' + result);
    if (checkingTicket.value || (cooldown.value && cooldownResult.value === result && cooldown.value > new Date()) || !result) {
        // Skip. Already working.
        return;
    }

    console.log('Processing result: ' + result);

    // Wait 2 seconds before rescanning
    cooldown.value = new Date(new Date().getTime() + 2 * 1000);
    cooldownResult.value = result;

    // Go a QR-code with value: result
    checkingTicket.value = true;
    checkTicket(result).then(() => {
        checkingTicket.value = false;
    }).catch(console.error);
}

function stopStream() {
    if (!stream.value) {
        return;
    }

    try {
        // Old browsers use old deprecated stop api on stream
        if (stream.value && (stream.value as any).stop) {
            (stream.value as any).stop();
            stream.value = null;
        }
        else {
            if (stream.value && stream.value.getTracks) {
                var track = stream.value.getTracks()[0]; // if only one media track
                track.stop();
                stream.value = null;
            }
        }
    }
    catch (e) {
        console.error(e);
    }
}

async function setStream(constraints: MediaStreamConstraints, force = false) {
    if (videoRef.value === null) {
        return;
    }

    if (pollInterval.value) {
        clearInterval(pollInterval.value);
        pollInterval.value = null;
    }
    const video = videoRef.value;
    // iOS fix
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    if (stream.value && stream.value.active && !force) {
        // Keep existing stream
        video.srcObject = stream.value;
    }
    else {
        stopStream();
        // Not adding `{ audio: true }` since we only want video now
        const mediaStream = await navigator.mediaDevices
            .getUserMedia(constraints);
        stream.value = mediaStream;
        video.srcObject = mediaStream;
    }
    video.play().catch(console.error);
    pollInterval.value = window.setInterval(() => pollImage(), 300);

    // Only request camera's after we got permission
    cameras.value = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    console.log("Camera's", cameras.value);

    try {
        const deviceId = stream.value.getVideoTracks()[0].getSettings().deviceId;
        const index = cameras.value.findIndex(c => c.deviceId === deviceId);
        if (index !== -1) {
            cameraIndex.value = index;
            console.log('Found camera index ', index);
        }
    }
    catch (e) {
        console.error(e);
    }
}

async function checkTicket(result: string) {
    if (!result.startsWith('https://')) {
        // Invalid ticket
        console.error('Not a url');
        invalidTicket();
        return;
    }

    const parts = result.split('/');
    let next = false;
    let secret: string | null = null;

    for (const part of parts) {
        if (next && part !== 'tickets') {
            secret = part;
            break;
        }
        if (part === 'tickets') {
            next = true;
        }
    }

    if (!secret) {
        console.error('No secret found');
        invalidTicket();
        return;
    }

    // Fetch ticket from database
    try {
        const ticket = await props.webshopManager.tickets.get(secret);
        if (ticket) {
            const order = await props.webshopManager.orders.get(ticket.orderId);
            if (!order) {
                AppManager.shared.hapticError();
                new Toast('Er ging iets mis. Dit is een geldig ticket, maar de bijhorende bestelling kon niet geladen worden. Waarschijnlijk heb je tijdelijk internet nodig om nieuwe bestellingen op te halen. Probeer daarna opnieuw.', 'error red').show();
            }
            else {
                if (ticket.itemId !== null) {
                    const item = order.data.cart.items.find(i => i.id === ticket.itemId);
                    if (item) {
                        const product = props.disabledProducts.find(p => p.id === item.product.id);
                        if (product) {
                            disabledTicket(product, ticket.scannedAt);
                            return;
                        }
                    }
                }

                if (ticket.deletedAt || order.status === OrderStatus.Canceled || order.status === OrderStatus.Deleted) {
                    canceledTicket();
                }
                else if (ticket.scannedAt !== null) {
                    alreadyScannedTicket(ticket, order);
                }
                else {
                    validTicket(ticket, order);
                }
            }
        }
        else {
            console.error('Ticket not found');
            invalidTicket();
        }
    }
    catch (e) {
        console.error(e);
        // database error
        Toast.fromError(e).show();

        AppManager.shared.hapticError();
    }
}

function alreadyScannedTicket(ticket: TicketPrivate, order: Order) {
    AppManager.shared.hapticWarning();

    // Disable scanning same one for 2 seconds
    cooldown.value = new Date(new Date().getTime() + 2 * 1000);

    show(new ComponentWithProperties(TicketAlreadyScannedView, {
        webshopManager: props.webshopManager,
        ticket,
        order,
    })).catch(console.error);
}

function validTicket(ticket: TicketPrivate, order: PrivateOrder) {
    AppManager.shared.hapticSuccess();

    // Disable scanning same one for 2 seconds
    cooldown.value = new Date(new Date().getTime() + 2 * 1000);

    show(new ComponentWithProperties(ValidTicketView, {
        webshopManager: props.webshopManager,
        ticket,
        order,
    })).catch(console.error);
}

function canceledTicket() {
    new Toast('Oeps! Dit ticket werd geannuleerd of verwijderd en is dus niet geldig.', 'error red').show();
    AppManager.shared.hapticError();
}

function disabledTicket(product: Product, scannedAt: Date | null) {
    // TODO: show invalid ticket
    new Toast('Dit is een ticket voor: ' + product.name + (scannedAt ? ', en werd bovendien al eens gescand.' : ''), 'error red').show();
    AppManager.shared.hapticError();
}

function invalidTicket() {
    // TODO: show invalid ticket
    new Toast('Ongeldig ticket', 'error red').show();
    AppManager.shared.hapticError();
}

async function startScanning() {
    if (rootRef.value === null) {
        return;
    }

    if (AppManager.shared.QRScanner) {
        // Make document transparent

        // Start (if still needed)
        try {
            await AppManager.shared.QRScanner.startScanning();
        }
        catch (e: any) {
            if (e.message && typeof e.message === 'string' && e.message.includes('Permission')) {
                new Toast('Geen toegang tot jouw camera. Ga naar de instellingen app om terug toegang te geven.', 'error red').show();
                return;
            }
            Toast.fromError(e).show();
            return;
        }

        // Delay (wait for transition)
        await sleep(300);

        // Use native QRScanner
        disableWebVideo.value = true;

        // Make background transparent to see the video underlay
        document.body.style.background = 'transparent';
        rootRef.value.style.background = 'transparent';

        // Disable scrolling (bouncing)
        document.body.style.overflow = 'hidden';

        if (!nativeListener) {
            nativeListener = await AppManager.shared.QRScanner.addListener('scannedQRCode', (result: { value: string }) => {
                validateQR(result.value);
            });
        }

        try {
            const torch = await AppManager.shared.QRScanner.getTorch();
            console.log(torch);
            isFlashOn.value = torch.status;
            hasFlash.value = true;
        }
        catch (e) {
            console.error(e);
        }

        return;
    }

    if (pollInterval.value) {
        clearInterval(pollInterval.value);
        pollInterval.value = null;
    }

    // Get access to the camera!
    if (navigator.mediaDevices) {
        await setStream(
            cameras.value.length > 0
                ? {
                        video: { deviceId: cameras.value[cameraIndex.value].deviceId },
                        audio: false,
                    }
                : {
                        video: { facingMode: 'environment' },
                        audio: false,
                    });
    }

    /* this.scanner = new QrScanner(videoRef.value as HTMLVideoElement, (result) => {

        }, undefined, undefined, "environment");
        await this.scanner.start() */

    /* hasFlash.value = await this.scanner.hasFlash()
        console.log('has flash', hasFlash.value)
        isFlashOn.value = this.scanner.isFlashOn() */
}

function stopScanning() {
    if (rootRef.value === null) {
        return;
    }

    if (AppManager.shared.QRScanner) {
        // remove other listeners
        if (nativeListener) {
            nativeListener.remove().catch(console.error);
            nativeListener = null;
        }

        // Use native QRScanner
        disableWebVideo.value = false;

        // Reset body
        document.body.style.background = '';
        document.body.style.overflow = '';
        rootRef.value.style.background = '';

        AppManager.shared.QRScanner.stopScanning().catch(console.error);
        return;
    }

    if (pollInterval.value) {
        clearInterval(pollInterval.value);
        pollInterval.value = null;
    }

    if (updateCurrentDateInterval.value) {
        clearInterval(updateCurrentDateInterval.value);
        updateCurrentDateInterval.value = null;
    }

    // Kill stream
    stopStream();
}

function pauseScanning() {
    if (AppManager.shared.QRScanner) {
        // remove other listeners
        if (nativeListener) {
            nativeListener.remove().catch(console.error);
            nativeListener = null;
        }

        // Use native QRScanner
        // disableWebVideo.value = false

        // Reset body overflow only
        // document.body.style.background = ""
        document.body.style.overflow = '';
        return;
    }

    if (pollInterval.value) {
        clearInterval(pollInterval.value);
        pollInterval.value = null;
    }
    // We keep stream alive to prevent slow start / delays / permission dialogs

    if (updateCurrentDateInterval.value) {
        clearInterval(updateCurrentDateInterval.value);
        updateCurrentDateInterval.value = null;
    }
}

onDeactivated(() => {
    pauseScanning();
});

onActivated(() => {
    // Prevent scanning previous one for 2 seconds
    cooldown.value = new Date(new Date().getTime() + 2 * 1000);

    // We restart the scanner every time because there is a bug in the qr scanner
    // that randomly breaks the scanning after some time when going back (recreating the video element)
    startScanning().catch(console.error);

    if (updateCurrentDateInterval.value) {
        clearInterval(updateCurrentDateInterval.value);
    }
    updateCurrentDateInterval.value = window.setInterval(() => {
        currentDate.value = new Date();
        if (!isLoading.value) {
            updateTickets().catch(console.error);
        }
    }, 1000 * 30);

    if (!isLoading.value) {
        updateTickets().catch(console.error);
    }
});

onBeforeUnmount(() => stopScanning());
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
        color: $color-background;
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

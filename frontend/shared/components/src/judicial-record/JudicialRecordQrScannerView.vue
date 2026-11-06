<template>
    <div ref="rootElement" class="st-view full-width judicial-record-qr-scanner-view">
        <STNavigationBar :show-title="false" :title="$t('QR-code scannen')" />

        <div class="video-container" :class="{ native: nativeCamera }">
            <template v-if="!nativeCamera && !cameraFailed">
                <video ref="videoElement" muted playsinline data-testid="judicial-record-qr-video" />
                <div class="scan-overlay" />
            </template>

            <!-- Over the code that was read, where the member is looking, rather than in the bar below -->
            <div v-if="fetching" class="fetch-overlay" data-testid="judicial-record-qr-fetching">
                <div class="fetch-spinner">
                    <Spinner />
                </div>
            </div>

            <div class="video-footer">
                <div class="button-bar">
                    <button v-if="hasFlash" class="round-button" :class="{ selected: isFlashOn }" type="button" :aria-label="$t('Zaklamp')" @click="toggleFlash">
                        <span class="icon flashlight" />
                    </button>
                    <button v-if="cameras.length > 1" class="round-button" type="button" :aria-label="$t('Andere camera')" @click="switchCamera">
                        <span class="icon reverse" />
                    </button>
                </div>

                <div class="status-bar" data-testid="judicial-record-qr-status">
                    <p v-if="fetching">
                        {{ $t('We halen het uittreksel op bij FOD Justitie...') }}
                    </p>
                    <p v-else-if="cameraFailed" data-testid="judicial-record-qr-camera-error">
                        {{ $t('We kunnen je camera niet gebruiken. Geef toegang tot je camera, of upload de pdf van het uittreksel.') }}
                    </p>
                    <p v-else-if="errorMessage" class="error" data-testid="judicial-record-qr-error">
                        {{ errorMessage }}
                    </p>
                    <p v-else>
                        {{ $t('Scan de QR-code op het uittreksel') }}<br>
                        <span class="style-description-small">{{ $t('We halen het originele document op bij FOD Justitie.') }}</span>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { isSimpleError, isSimpleErrors } from '@common/errors';
import { Request } from '@common/networking';
import { useDismiss } from '@browser/navigation';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import type { PlatformMember } from '@stamhoofd/structures';
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import Spinner from '../Spinner.vue';
import { useQrScanner } from '../hooks/useQrScanner';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import { readJudicialRecordExtractUrl } from './judicialRecordExtractUrl';
import { useFetchJudicialRecordPdf } from './useFetchJudicialRecordPdf';

const props = defineProps<{
    member: PlatformMember;

    /**
     * Hands the extract that was behind the code to the delivery step, which continues the flow with
     * it, together with the link it came from.
     */
    selectHandler: (file: File, url: string) => Promise<void>;
}>();

const dismiss = useDismiss();
const fetchJudicialRecordPdf = useFetchJudicialRecordPdf();

const rootElement = useTemplateRef<HTMLElement>('rootElement');
const videoElement = useTemplateRef<HTMLVideoElement>('videoElement');
const fetching = ref(false);
const errorMessage = ref<string | null>(null);

/** The code that was refused last, so holding it in front of the camera does not keep buzzing */
let lastRefusedCode: string | null = null;

/**
 * The link that could not be fetched. The camera keeps reading it while the member still holds the
 * extract in front of it, and every read would be another request, another error and another buzz.
 * It is tried again once the scanner is opened again; another code is read as usual.
 */
let failedUrl: string | null = null;

const { cameras, hasFlash, isFlashOn, nativeCamera, cameraFailed, start, pause, resume, stop, switchCamera, toggleFlash } = useQrScanner({
    video: videoElement,
    root: rootElement,
    onCode: (value) => {
        readCode(value).catch(console.error);
    },
});

onMounted(() => {
    start().catch(console.error);
});

onBeforeUnmount(() => {
    stop();
});

/**
 * A QR-code the camera read. Only the link FOD Justitie prints is accepted, and anything else leaves
 * the scanner running: the member is most likely pointing it at the wrong code, not at a broken one.
 */
async function readCode(value: string) {
    if (fetching.value) {
        return;
    }

    const url = readJudicialRecordExtractUrl(value);

    if (url === null) {
        if (lastRefusedCode !== value) {
            lastRefusedCode = value;
            AppManager.shared.hapticError();
        }
        errorMessage.value = $t('Dit is niet de QR-code van een uittreksel uit het strafregister. Scan de code op het uittreksel.');
        return;
    }

    if (url === failedUrl) {
        return;
    }

    await deliver(url);
}

/**
 * The pdf arrives at the delivery step the way an uploaded one does, so the control step cannot tell
 * the two apart. The scanner closes first: the next step is pushed by the step underneath it.
 */
async function deliver(url: string) {
    fetching.value = true;
    errorMessage.value = null;
    lastRefusedCode = null;
    failedUrl = null;

    // Nothing to scan any more while the request runs
    pause();

    let file: File;
    try {
        file = await fetchJudicialRecordPdf(props.member.id, url);
    } catch (error) {
        AppManager.shared.hapticError();
        if (Request.isNetworkError(error)) {
            errorMessage.value = $t(`%ge`);
        } else if (isSimpleError(error) || isSimpleErrors(error)) {
            errorMessage.value = error.getHuman();
        } else {
            errorMessage.value = $t('We konden het uittreksel niet ophalen bij FOD Justitie. Probeer het opnieuw.');
        }
        failedUrl = url;
        fetching.value = false;
        resume();
        return;
    }

    fetching.value = false;
    AppManager.shared.hapticSuccess();

    await dismiss({ force: true });
    await props.selectHandler(file, url);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.judicial-record-qr-scanner-view {
    --st-vertical-padding: 0px;
    --navigation-bar-horizontal-padding: 7px;

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
            max-width: 400px;
            aspect-ratio: 1 / 1;
            position: absolute;
            left: 50%;
            top: 50%;
            border: 4px solid white;
            border-radius: 5px;
            transform: translate(-50%, -50%);
        }

        &.native {
            background: transparent;
        }
    }

    .fetch-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.4);
    }

    .fetch-spinner {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 96px;
        height: 96px;
        border-radius: 50%;
        background: $color-background;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);

        // The spinner draws a vector, so it stays sharp at twice its size
        .spinner-container,
        .spinner-container > div.spinner,
        .spinner-container > div.spinner > svg {
            width: 48px;
            height: 48px;
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
            padding: 15px;
            padding-bottom: calc(var(--st-safe-area-bottom, 0px) + 15px);
            text-align: center;
            color: $color-dark;
            font-size: 14px;
            line-height: 1.4;

            .error {
                color: $color-error;
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

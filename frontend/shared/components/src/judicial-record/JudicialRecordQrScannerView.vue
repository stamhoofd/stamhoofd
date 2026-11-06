<template>
    <div class="st-view judicial-record-qr-scanner-view">
        <STNavigationBar :title="$t('QR-code scannen')" />

        <main>
            <h1>
                {{ $t('Scan de QR-code op je uittreksel') }}
            </h1>

            <p>
                {{ $t('De QR-code staat op je uittreksel uit het strafregister. Je kan hem scannen van papier of van een ander scherm. We halen het originele document dan rechtstreeks bij FOD Justitie op.') }}
            </p>

            <div v-if="cameraFailed" class="judicial-record-qr-camera-error info-box icon camera" data-testid="judicial-record-qr-camera-error">
                {{ $t('We kunnen je camera niet gebruiken. Plak de link van de QR-code hieronder, dan werkt het ook.') }}
            </div>

            <div v-else class="judicial-record-qr-video">
                <video ref="videoElement" muted playsinline data-testid="judicial-record-qr-video" />
            </div>

            <p v-if="fetching" class="loading-box">
                <Spinner />
                {{ $t('We halen je uittreksel op bij FOD Justitie...') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <hr><h2>{{ $t('Of plak de link') }}</h2>

            <p>
                {{ $t('Staat de link onder de QR-code, of kan je hem kopiëren? Plak hem hier.') }}
            </p>

            <STInputBox class="max" :title="$t('Link van de QR-code')">
                <input
                    v-model="pastedUrl"
                    class="input"
                    type="url"
                    inputmode="url"
                    autocomplete="off"
                    spellcheck="false"
                    :disabled="fetching"
                    :placeholder="JUDICIAL_RECORD_EXTRACT_URL_EXAMPLE"
                    data-testid="judicial-record-qr-url-input"
                    @keydown.enter.prevent="useLink"
                >
            </STInputBox>

            <p class="style-button-bar right-align">
                <LoadingButton :loading="fetching">
                    <button class="button primary" type="button" :disabled="pastedUrl.trim().length === 0" data-testid="judicial-record-qr-use-link" @click="useLink">
                        <span>{{ $t('Link gebruiken') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from '@common/errors';
import { useDismiss } from '@browser/navigation';
import type { PlatformMember } from '@stamhoofd/structures';
import QrScanner from 'qr-scanner';
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import Spinner from '../Spinner.vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useErrors } from '../errors/useErrors';
import STInputBox from '../inputs/STInputBox.vue';
import LoadingButton from '../navigation/LoadingButton.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import { readJudicialRecordExtractUrl } from './judicialRecordExtractUrl';
import { useFetchJudicialRecordPdf } from './useFetchJudicialRecordPdf';

const props = defineProps<{
    member: PlatformMember;

    /** Hands the extract that was behind the code to the delivery step, which continues the flow with it. */
    selectHandler: (file: File) => Promise<void>;
}>();

/** Shown in the paste field, so a member sees what kind of link is expected. This one returns nothing. */
const JUDICIAL_RECORD_EXTRACT_URL_EXAMPLE = 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS';

const dismiss = useDismiss();
const errors = useErrors();
const fetchJudicialRecordPdf = useFetchJudicialRecordPdf();

const videoElement = useTemplateRef<HTMLVideoElement>('videoElement');
const pastedUrl = ref('');
const fetching = ref(false);

/** Without a camera the paste field is the only way in, so it takes the place of the video. */
const cameraFailed = ref(false);

let scanner: QrScanner | null = null;

onMounted(() => {
    startScanner().catch(console.error);
});

onBeforeUnmount(() => {
    scanner?.destroy();
    scanner = null;
});

async function startScanner() {
    if (!videoElement.value) {
        return;
    }

    try {
        scanner = new QrScanner(videoElement.value, (result) => {
            readCode(result.data).catch(console.error);
        }, {
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            // The code is on a document held in front of the camera, not on something far away
            preferredCamera: 'environment',
        });

        await scanner.start();
    }
    catch (error) {
        // No camera, no permission, or a browser that will not hand one over: all the same answer.
        console.error(error);
        scanner?.destroy();
        scanner = null;
        cameraFailed.value = true;
    }
}

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
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: $t('Dit is niet de QR-code van een uittreksel uit het strafregister. Scan de code op je uittreksel.'),
        }));
        return;
    }

    await deliver(url);
}

async function useLink() {
    const url = readJudicialRecordExtractUrl(pastedUrl.value);

    if (url === null) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: $t('Dit is geen link naar een uittreksel uit het strafregister. Kopieer de link die bij de QR-code op je uittreksel staat.'),
        }));
        return;
    }

    await deliver(url);
}

/**
 * The pdf arrives at the delivery step the way an uploaded one does, so the control step cannot tell
 * the two apart. The scanner closes first: the next step is pushed by the step underneath it.
 */
async function deliver(url: string) {
    if (fetching.value) {
        return;
    }

    fetching.value = true;
    errors.errorBox = null;

    // Nothing to scan any more, and the camera should not stay on during the request
    scanner?.stop();

    let file: File;
    try {
        file = await fetchJudicialRecordPdf(props.member.id, url);
    }
    catch (error) {
        errors.errorBox = new ErrorBox(error);
        fetching.value = false;

        scanner?.start().catch(console.error);
        return;
    }

    fetching.value = false;

    await dismiss({ force: true });
    await props.selectHandler(file);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.judicial-record-qr-scanner-view {
    .judicial-record-qr-video {
        margin-top: 15px;
        border-radius: $border-radius;
        overflow: hidden;
        background: $color-gray-4;

        > video {
            display: block;
            width: 100%;
            // A document held in front of the camera is wider than it is tall
            aspect-ratio: 4 / 3;
            object-fit: cover;
        }
    }

    .judicial-record-qr-camera-error {
        margin-top: 15px;
    }
}
</style>

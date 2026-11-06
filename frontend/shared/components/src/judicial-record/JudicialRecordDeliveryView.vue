<template>
    <div class="st-view judicial-record-delivery-view" v-on="dropHandlers">
        <STNavigationBar :title="$t('Uittreksel uit het strafregister')" />

        <main>
            <p class="style-title-prefix">
                {{ $t('%1WP', { current: stepNumber.toString(), total: stepCount.toString() }) }}
            </p>

            <h1>
                {{ $t('Uittreksel uit het strafregister') }}
            </h1>

            <p>
                {{ $t('Laat je uittreksel uit het strafregister hieronder controleren, het moet voldoen aan deze voorwaarden:') }}
            </p>

            <STList>
                <STListItem class="left-center">
                    <template #left>
                        <span class="icon file-filled" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Model 596.2') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Het uittreksel voor activiteiten met minderjarigen (artikel 596, tweede lid). Een gewoon uittreksel (596.1) is niet geldig.') }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <span class="icon clock-bold" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Maximaal 1 maand oud') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Het uittreksel mag maximaal 1 maand oud zijn op het moment dat je het instuurt.') }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <span class="icon government" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Gratis aan te vragen') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Via Mijn Burgerprofiel, de website of het loket van je gemeente. Zonder eID of vaste woonplaats via de Dienst Centraal Strafregister.') }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <span class="icon file-qr-filled" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Het originele document') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Ontving je het document digitaal? Upload het hieronder.') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Heb je een papieren versie? Gebruik onze scanner om de QR-code te scannen op het uittreksel.') }}
                    </p>
                </STListItem>
            </STList>

            <hr>

            <p>
                <a class="button text selected" :href="AMBRASSADE_URL" target="_blank" rel="noopener">
                    <span class="icon external" />
                    <span>{{ $t('Hoe vraag ik een uittreksel aan?') }}</span>
                </a>
            </p>

            <!-- Where a file can be dropped is easier to find with a place for it. Nothing gets dragged on a phone. -->
            <FileDropZone
                v-if="!$isMobile"
                class="judicial-record-drop-zone"
                :title="$t('Sleep het bestand hierheen')"
                accept="application/pdf"
                :dragging="dragging"
                data-testid="judicial-record-pdf-drop-area"
                @select="(file: File) => continueWith(file)"
            />

            <p v-if="!$isMobile" class="style-button-bar right-align judicial-record-delivery-actions">
                <button class="button secundary" type="button" data-testid="judicial-record-scan-qr" @click="scanQrCode">
                    <span class="icon qr-code" />
                    <span>{{ $t('QR-code scannen') }}</span>
                </button>

                <label class="button primary" data-testid="judicial-record-pdf-upload">
                    <span class="icon upload" />
                    <span>{{ $t('Bestand kiezen') }}</span>
                    <!-- Last, so the icon is the first child the button styles align -->
                    <input type="file" accept="application/pdf" class="file-upload" data-testid="judicial-record-pdf-input" @change="onChangeFile">
                </label>
            </p>
        </main>

        <STToolbar v-if="$isMobile" class="judicial-record-delivery-actions">
            <template #right>
                <button class="button secundary" type="button" data-testid="judicial-record-scan-qr" @click="scanQrCode">
                    <span class="icon qr-code" />
                    <span>{{ $t('QR-code scannen') }}</span>
                </button>

                <label class="button primary" data-testid="judicial-record-pdf-upload">
                    <span class="icon upload" />
                    <span>{{ $t('Bestand kiezen') }}</span>
                    <!-- Last, so the icon is the first child the button styles align -->
                    <input type="file" accept="application/pdf" class="file-upload" data-testid="judicial-record-pdf-input" @change="onChangeFile">
                </label>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController } from '@browser/navigation';
import { onActivated } from 'vue';
import { AsyncComponent } from '../containers/AsyncComponent';
import FileDropZone from '../inputs/FileDropZone.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import { useNavigationActions } from '../types/NavigationActions';
import type { JudicialRecordStepProps } from './JudicialRecordStepProps';
import { useJudicialRecordPdfSelection } from './useJudicialRecordPdfSelection';

const props = defineProps<JudicialRecordStepProps>();

const AMBRASSADE_URL = 'https://www.ambrassade.be/themas/uittreksel-strafregister/usr-info-voor-vrijwilligers';

const navigate = useNavigationActions();

/**
 * Both methods end here, and both move on right away with whatever file was picked: the control step
 * judges it, next to the file itself, and sends it in when nothing needs fixing.
 */
async function continueWith(file: File, url: string | null = null) {
    props.delivery.file = file;
    props.delivery.url = url;
    props.delivery.report = null;
    props.delivery.status = null;

    await props.saveHandler(navigate);
}

const { dragging, dropHandlers } = useJudicialRecordPdfSelection((file) => {
    continueWith(file).catch(console.error);
});

/**
 * Coming back here means delivering another extract, so the step starts over: the previous choice
 * is gone and the control step only ever runs on a file that was picked after the member returned.
 */
onActivated(() => {
    props.delivery.file = null;
    props.delivery.url = null;
    props.delivery.report = null;
    props.delivery.status = null;
});

function onChangeFile(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) {
        return;
    }
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        continueWith(file).catch(console.error);
    }
    // Clear the selection, so picking the same file again still fires a change event
    target.value = '';
}

/**
 * The scanner is presented on top of this step rather than being a step of its own: it is one of two
 * ways to answer the same question, and it closes itself once it has the document. It covers the
 * screen like the ticket scanner, which the native camera of the app needs to draw underneath it.
 */
async function scanQrCode() {
    await navigate.present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./JudicialRecordQrScannerView.vue'), {
                    member: props.member,
                    selectHandler: (file: File, url: string) => continueWith(file, url),
                }),
            }),
        ],
    });
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.judicial-record-delivery-view {
    .file-upload {
        display: none;
    }

    .judicial-record-drop-zone {
        margin-top: 15px;
    }
}
</style>

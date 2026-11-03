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
                {{ organization
                    ? $t('Als leiding bij {organization} moet je een uittreksel uit het strafregister laten controleren. Je uittreksel moet aan deze voorwaarden voldoen:', { organization: organization.name })
                    : $t('Als leiding moet je een uittreksel uit het strafregister laten controleren. Je uittreksel moet aan deze voorwaarden voldoen:') }}
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
                        {{ $t('Op het moment dat je het uploadt. Vraag het dus pas aan vlak voor je het uploadt.') }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <span class="icon government" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Hoe vraag ik een uittreksel aan?') }}
                    </h3>
                    <p class="style-description-small">
                        <I18nComponent :t="$t('Via Mijn Burgerprofiel, de website of het loket van je gemeente. Zonder eID of vaste woonplaats via de Dienst Centraal Strafregister. Dit is gratis. <button>Meer info bij De Ambrassade</button>')">
                            <template #button="{ content }">
                                <a :href="AMBRASSADE_URL" class="inline-link" rel="nofollow noreferrer noopener" target="_blank">{{ content }}</a>
                            </template>
                        </I18nComponent>
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('Hoe wil je je uittreksel aanleveren?') }}</h2>

            <STInputBox class="max" error-fields="*" :error-box="errorBox" :title="$t('Uittreksel (PDF)')">
                <label class="judicial-record-pdf-drop-area" :class="{ dragging, verifying }" data-testid="judicial-record-pdf-drop-area">
                    <input ref="fileInput" type="file" accept="application/pdf" class="file-upload" :disabled="verifying" @change="onChangeFile">

                    <template v-if="verifying">
                        <Spinner />
                        <p class="style-description">
                            {{ $t('We controleren de handtekening...') }}
                        </p>
                    </template>

                    <template v-else>
                        <span class="icon" :class="selectedFile ? 'file-pdf color-pdf' : 'upload'" />
                        <p :class="selectedFile ? 'style-title-list' : 'style-description'">
                            {{ selectedFile ? selectedFile.name : $t('Kies een bestand of sleep het hierheen') }}
                        </p>
                    </template>
                </label>
            </STInputBox>

            <p v-if="errorBox" class="style-button-bar right-align">
                <!-- Scanning the code on a paper extract is the way out of a pdf we cannot check, and arrives with the scanner. -->
                <button class="button secondary" type="button" disabled data-testid="judicial-record-scan-qr">
                    <span>{{ $t('QR-code scannen') }}</span>
                </button>

                <button class="button primary" type="button" data-testid="judicial-record-choose-other" @click="fileInput?.click()">
                    <span>{{ $t('Ander bestand kiezen') }}</span>
                </button>
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { computed, onActivated, ref, useTemplateRef } from 'vue';
import Spinner from '../Spinner.vue';
import STInputBox from '../inputs/STInputBox.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import { useNavigationActions } from '../types/NavigationActions';
import type { JudicialRecordStepProps } from './JudicialRecordStepProps';
import { useJudicialRecordPdfSelection } from './useJudicialRecordPdfSelection';

const props = defineProps<JudicialRecordStepProps>();

const AMBRASSADE_URL = 'https://www.ambrassade.be/themas/uittreksel-strafregister';

const navigate = useNavigationActions();

const organization = computed(() => props.member.filterOrganizations({ currentPeriod: true })[0] ?? null);

const selectedFile = ref<File | null>(null);
const fileInput = useTemplateRef<HTMLInputElement>('fileInput');

/**
 * Picking a pdf is the whole of this step, so there is nothing left to confirm: the control step
 * opens straight away and starts the request on it.
 */
const { errorBox, dragging, verifying, selectFile, dropHandlers } = useJudicialRecordPdfSelection((file) => {
    selectedFile.value = file;
    props.delivery.file = file;

    props.saveHandler(navigate).catch(console.error);
});

/**
 * Coming back here means delivering another extract, so the step starts over: the previous choice
 * is gone and the control step only ever runs on a file that was picked after the member returned.
 */
onActivated(() => {
    selectedFile.value = null;
    props.delivery.file = null;
});

function onChangeFile(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) {
        return;
    }
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        selectFile(file).catch(console.error);
    }
    // Clear the selection, so picking the same file again still fires a change event
    target.value = '';
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.judicial-record-pdf-drop-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 120px;
    padding: 20px;
    box-sizing: border-box;
    text-align: center;
    border: $border-width solid $color-border;
    border-radius: $border-radius;
    background: $color-background;
    cursor: pointer;
    transition: border-color 0.2s, background-color 0.2s;

    &.verifying {
        cursor: progress;
    }
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    touch-action: manipulation;

    > .file-upload {
        display: none;
    }

    > .icon {
        color: $color-gray-5;
        transition: color 0.2s;
    }

    &:hover {
        border-color: $color-primary-gray-light;

        > .icon:not(.color-pdf) {
            color: $color-primary;
        }
    }

    &.dragging {
        border-color: $color-primary;
        background: $color-primary-background;

        > .icon:not(.color-pdf) {
            color: $color-primary;
        }
    }
}
</style>

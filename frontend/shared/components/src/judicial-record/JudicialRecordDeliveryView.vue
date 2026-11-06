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

            <hr><h2>{{ $t('Hoe wil je je uittreksel aanleveren?') }}</h2>

            <STErrorsDefault :error-box="errorBox" />

            <STList class="illustration-list">
                <STListItem
                    class="left-center judicial-record-delivery-method"
                    :class="{ dragging }"
                    :selectable="true"
                    element-name="label"
                    data-testid="judicial-record-pdf-drop-area"
                >
                    <input type="file" accept="application/pdf" class="file-upload" data-testid="judicial-record-pdf-input" @change="onChangeFile">

                    <template #left>
                        <span class="icon file-pdf color-pdf" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('De pdf uploaden') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $isMobile
                            ? $t('Kies de pdf die je van FOD Justitie kreeg. Een scan of een foto kunnen we niet controleren.')
                            : $t('Kies de pdf die je van FOD Justitie kreeg, of sleep ze hierheen. Een scan of een foto kunnen we niet controleren.') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    class="left-center judicial-record-delivery-method"
                    :selectable="true"
                    data-testid="judicial-record-scan-qr"
                    @click="scanQrCode"
                >
                    <template #left>
                        <span class="icon qr-code" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('De QR-code scannen') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Heb je je uittreksel op papier of op een ander toestel? Scan de QR-code erop, dan halen we het document bij FOD Justitie op.') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { computed, onActivated } from 'vue';
import { AsyncComponent } from '../containers/AsyncComponent';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
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

/**
 * Both methods end here, and nothing about the document is decided in this step: whether it is the
 * right extract, signed and recent enough, is what the control step opens to find out.
 */
function continueWith(file: File) {
    props.delivery.file = file;

    return props.saveHandler(navigate);
}

const { errorBox, dragging, selectFile, dropHandlers } = useJudicialRecordPdfSelection((file) => {
    continueWith(file).catch(console.error);
});

/**
 * Coming back here means delivering another extract, so the step starts over: the previous choice
 * is gone and the control step only ever runs on a file that was picked after the member returned.
 */
onActivated(() => {
    props.delivery.file = null;
});

function onChangeFile(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) {
        return;
    }
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        selectFile(file);
    }
    // Clear the selection, so picking the same file again still fires a change event
    target.value = '';
}

/**
 * The scanner is presented on top of this step rather than being a step of its own: it is one of two
 * ways to answer the same question, and it closes itself once it has the document.
 */
async function scanQrCode() {
    await navigate.present({
        modalDisplayStyle: 'popup',
        components: [
            AsyncComponent(() => import('./JudicialRecordQrScannerView.vue'), {
                member: props.member,
                selectHandler: continueWith,
            }),
        ],
    });
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.judicial-record-delivery-view {
    .judicial-record-delivery-method {
        transition: background-color 0.2s;

        // The list item wraps its content, so the input is not a child of the row itself
        .file-upload {
            display: none;
        }

        &.dragging {
            background: $color-primary-background;
        }
    }
}
</style>

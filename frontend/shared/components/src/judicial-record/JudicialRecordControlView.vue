<template>
    <div class="st-view judicial-record-control-view">
        <STNavigationBar :title="$t('Controle')" />

        <main>
            <p class="style-title-prefix">
                {{ $t('%1WP', { current: stepNumber.toString(), total: stepCount.toString() }) }}
            </p>

            <h1>
                {{ $t('Controle') }}
            </h1>

            <p v-if="checking" class="loading-box" data-testid="judicial-record-checking">
                <Spinner />
                {{ $t('We controleren je uittreksel...') }}
            </p>

            <p v-else-if="delivering && !showChecks" class="loading-box" data-testid="judicial-record-delivering">
                <Spinner />
                {{ $t('We bezorgen je uittreksel...') }}
            </p>

            <TransitionFade v-else>
                <p
                    v-if="!showChecks"
                    key="summary"
                    class="icon selectable with-button"
                    :class="[summary.boxClass, summary.icon]"
                    data-testid="judicial-record-summary"
                    @click="showChecks = true"
                >
                    <span>
                        <strong>{{ summary.title }}</strong>
                        <span>{{ summary.description }}</span>
                    </span>

                    <button class="button text" type="button" data-testid="judicial-record-show-checks">
                        {{ $t('Toon stappen') }}
                    </button>
                </p>

                <div v-else key="checks" class="container">
                    <JudicialRecordCheckList :report="report" :show-outcome="false" />
                </div>
            </TransitionFade>

            <div v-if="pdfData" class="container">
                <hr><h2>{{ $t('Je uittreksel') }}</h2>

                <!-- A document we cannot draw says so, rather than leaving an empty frame under a verdict. -->
                <p v-if="viewerFailed" class="info-box icon file" data-testid="judicial-record-viewer-error">
                    {{ $t('We kunnen dit document hier niet weergeven. Open het in je eigen pdf-lezer om het na te kijken.') }}
                </p>

                <PdfViewer v-else :data="pdfData" @error="onViewerError" />
            </div>

            <template v-if="!$isMobile">
                <hr><p class="style-button-bar right-align">
                    <template v-if="canClose">
                        <button class="button primary" type="button" data-testid="judicial-record-close" @click="close">
                            <span>{{ $t('Sluiten') }}</span>
                        </button>
                    </template>

                    <template v-else>
                        <LoadingButton :loading="delivering">
                            <button class="button" :class="submit.isPreferred ? 'primary' : 'secundary'" type="button" data-testid="judicial-record-send-anyway" @click="deliver">
                                <span>{{ submit.label }}</span>
                            </button>
                        </LoadingButton>

                        <button class="button" :class="submit.isPreferred ? 'secundary' : 'primary'" type="button" :disabled="delivering" data-testid="judicial-record-retry-upload" @click="deliverAgain">
                            <span>{{ $t('Ander document proberen') }}</span>
                        </button>
                    </template>
                </p>
            </template>
        </main>

        <!-- A long extract in the viewer would push the buttons off the screen, so on a phone they stay on it. -->
        <STToolbar v-if="$isMobile">
            <template #right>
                <template v-if="canClose">
                    <button class="button primary" type="button" data-testid="judicial-record-close" @click="close">
                        <span>{{ $t('Sluiten') }}</span>
                    </button>
                </template>

                <template v-else>
                    <LoadingButton :loading="delivering">
                        <button class="button" :class="submit.isPreferred ? 'primary' : 'secundary'" type="button" data-testid="judicial-record-send-anyway" @click="deliver">
                            <span>{{ submit.label }}</span>
                        </button>
                    </LoadingButton>

                    <button class="button" :class="submit.isPreferred ? 'secundary' : 'primary'" type="button" :disabled="delivering" data-testid="judicial-record-retry-upload" @click="deliverAgain">
                        <span>{{ $t('Ander document proberen') }}</span>
                    </button>
                </template>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { isSimpleError, isSimpleErrors } from '@common/errors';
import PdfViewer from '@stamhoofd/frontend-pdf-viewer/PdfViewer.vue';
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';
import type { JudicialRecordCheckResult } from '@stamhoofd/structures';
import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordDeliveryStatus, judicialRecordChecksInOrder } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import Spinner from '../Spinner.vue';
import LoadingButton from '../navigation/LoadingButton.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import TransitionFade from '../transitions/TransitionFade.vue';
import JudicialRecordCheckList from '../members/components/judicial-record/JudicialRecordCheckList.vue';
import { JudicialRecordCheckOutcome, getJudicialRecordCheckOutcome, useJudicialRecordCheckTranslations } from '../members/components/judicial-record/useJudicialRecordCheckTranslations';
import { useNavigationActions } from '../types/NavigationActions';
import type { JudicialRecordStepProps } from './JudicialRecordStepProps';
import { useDeliverJudicialRecord } from './useDeliverJudicialRecord';
import { JUDICIAL_RECORD_MAX_AGE_IN_DAYS } from './useJudicialRecordPdfSelection';

const props = defineProps<JudicialRecordStepProps>();

const navigate = useNavigationActions();
const deliverJudicialRecord = useDeliverJudicialRecord();
const { getTitle } = useJudicialRecordCheckTranslations();

/** Null until the control in the browser is done, which is what the spinner is on the screen for. */
const report = ref<JudicialRecordCheckReport | null>(null);
const checking = ref(true);

/** The pdf the member is looking at, kept apart from the copy the checks were run on. */
const pdfData = ref<Uint8Array | null>(null);

const delivering = ref(false);
const deliveryStatus = ref<JudicialRecordDeliveryStatus | null>(null);

/**
 * What the backend answered when it refused the document. The browser ran the same checks first, so
 * this is something it could not know: a revoked certificate, or no connection at all.
 */
const deliveryError = ref<unknown>(null);

/** The summary box collapses into the checks, and once opened it stays open. */
const showChecks = ref(false);

/**
 * The viewer could not draw this document. It says nothing about the checks - those ran on the same
 * bytes and have their own verdict - so only the frame is replaced, not the conclusion.
 */
const viewerFailed = ref(false);

function onViewerError(error: Error) {
    console.error(error);
    viewerFailed.value = true;
}

/**
 * The control runs here and not in the delivery step: a member first sees the document they picked,
 * and a signature that does not hold is one of the things this step tells them about.
 */
onMounted(() => {
    control().catch(console.error);
});

async function control() {
    const file = props.delivery.file;

    if (file === null) {
        // Only reachable through the delivery step, which always puts the chosen file in here first.
        return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // The checks read the pdf with pdfjs, which transfers the buffer it is handed to a worker and
    // leaves it detached. The viewer copies what it gets, so this copy is for the checks' sake.
    pdfData.value = bytes.slice();

    try {
        const outcome = await checkJudicialRecord({
            data: bytes,
            firstName: props.member.patchedMember.details.firstName,
            lastName: props.member.patchedMember.details.lastName,
            birthDay: props.member.patchedMember.details.birthDay,
            maxAgeInDays: JUDICIAL_RECORD_MAX_AGE_IN_DAYS,
        });

        report.value = outcome.report;
    }
    finally {
        checking.value = false;
    }

    // Nothing is left to decide when everything held, so the member does not have to press anything
    if (report.value?.isPassed === true) {
        await deliver();
    }
}

/**
 * Hands the document to the backend. It runs the same checks again and looks up what the browser
 * cannot - whether a certificate was revoked - so it has the last word on whether this is an extract
 * at all, and whether a person still has to look at it.
 */
async function deliver() {
    const file = props.delivery.file;

    if (file === null || delivering.value) {
        return;
    }

    delivering.value = true;
    deliveryError.value = null;

    try {
        deliveryStatus.value = await deliverJudicialRecord(props.member.id, file);
    }
    catch (error) {
        deliveryError.value = error;
    }
    finally {
        delivering.value = false;

        // What the backend answered is news, and the box is where this step says things. A member
        // who opened the checks before sending it in would otherwise be left with five rows they
        // have already read and no word about what just happened.
        showChecks.value = false;
    }
}

/** Back to the delivery step, which is the step right below this one, with nothing selected. */
async function deliverAgain() {
    await navigate.pop({ force: true });
}

async function close() {
    await props.dismissHandler(navigate);
}

/**
 * Sending the document to the backend anyway. After a verdict the member disagrees with, that is
 * insisting, and trying another document is the better idea - but after a delivery that never
 * landed, the same button is simply another attempt, and the one to reach for: a revocation lookup
 * that could not establish a status asks to be retried later, not to be answered with a new
 * document the member does not have.
 */
const submit = computed(() => deliveryError.value !== null
    ? { label: $t('Opnieuw proberen'), isPreferred: true }
    : { label: $t('Toch inzenden'), isPreferred: false },
);

/** Once it is in, there is nothing left to try: the only thing left to do is leave. */
const canClose = computed(() => deliveryStatus.value !== null);

/**
 * The first check that did not pass, blank aside. Both a rejection and a check without a verdict
 * count: a signature that does not hold leaves the four content checks unanswered, and the sentence
 * that explains why sits on the signature check itself.
 */
const firstProblem = computed((): JudicialRecordCheckResult | null => {
    if (report.value === null) {
        return null;
    }

    for (const check of judicialRecordChecksInOrder) {
        if (check === JudicialRecordCheck.Blank) {
            continue;
        }

        const result = report.value.get(check);
        if (result !== null && !result.isPassed) {
            return result;
        }
    }

    return null;
});

type SummaryBox = {
    boxClass: string;
    icon: string;
    title: string;
    description: string;
};

/**
 * One box saying where the member stands, in the pattern of SetupStepsView: the five steps are
 * behind it and only come out when they ask for them. The sentences about a rejection are the ones
 * the checks produced - which step refused the document and what to do about it - because rewording
 * them here would throw away the part that tells someone what to do next.
 */
const summary = computed((): SummaryBox => {
    if (deliveryError.value !== null) {
        return {
            boxClass: 'error-box',
            icon: 'warning',
            title: $t('We konden je uittreksel niet inzenden'),
            description: getErrorMessage(deliveryError.value),
        };
    }

    if (deliveryStatus.value === JudicialRecordDeliveryStatus.AutoOk) {
        return {
            boxClass: 'success-box',
            icon: 'success',
            title: $t('Je uittreksel is goedgekeurd'),
            description: $t('Je document is meteen verwijderd. We bewaren enkel dat het gecontroleerd is en wanneer.'),
        };
    }

    if (deliveryStatus.value === JudicialRecordDeliveryStatus.Manual) {
        return {
            boxClass: 'warning-box',
            icon: 'clock',
            title: $t('Je uittreksel wordt beoordeeld'),
            description: $t('Een controleur bekijkt het en neemt indien nodig contact met je op. Je document wordt verwijderd zodra het beoordeeld is.'),
        };
    }

    // The colour is the outcome of the five results, read in the one place that reads them
    switch (report.value === null ? null : getJudicialRecordCheckOutcome(report.value)) {
        case JudicialRecordCheckOutcome.Passed:
            return {
                boxClass: 'success-box',
                icon: 'success',
                title: $t('Je uittreksel is in orde'),
                description: $t('Alle controles slaagden en je strafregister is blanco.'),
            };

        case JudicialRecordCheckOutcome.NotBlank:
            return {
                boxClass: 'warning-box',
                icon: 'clock',
                title: $t('Je uittreksel is echt, maar niet blanco'),
                description: $t('Er staat iets op je uittreksel. Stuur het in: een controleur bekijkt het en neemt indien nodig contact met je op.'),
            };

        default: {
            // A check that refused the document and one that never got a verdict are the same thing
            // to the member: we could not place this document, and that check says why.
            const problem = firstProblem.value;

            if (problem === null) {
                return {
                    boxClass: 'error-box',
                    icon: 'warning',
                    title: $t('We konden je uittreksel niet controleren'),
                    description: $t('Probeer het opnieuw, of stuur het document in: een controleur bekijkt het.'),
                };
            }

            return {
                boxClass: 'error-box',
                icon: 'warning',
                title: $t('{check}: dit klopt niet', { check: getTitle(problem.check) }),
                description: problem.check === JudicialRecordCheck.Authentic
                    // Nothing is wrong with the document itself here: it is a scan, a photo or a
                    // print of one, and the code on it still leads to the original.
                    ? problem.reason + ' ' + $t('Scan de QR-code op je uittreksel, dan halen we het originele document op.')
                    : problem.reason,
            };
        }
    }
});

function getErrorMessage(error: unknown): string {
    if (isSimpleError(error) || isSimpleErrors(error)) {
        return error.getHuman();
    }

    return $t('Er ging iets mis bij het inzenden. Probeer het later opnieuw.');
}
</script>

<style lang="scss">
.judicial-record-control-view {
    > main > .success-box,
    > main > .warning-box,
    > main > .error-box {
        // The title is a line of its own, the way the checklist sets its own box
        strong {
            display: block;
        }
    }
}
</style>

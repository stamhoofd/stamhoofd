<template>
    <PreviewPanel v-model:wide="previewWide">
        <div class="st-view judicial-record-control-view">
            <STNavigationBar :title="$t('Controle')" />

            <main>
                <p class="style-title-prefix">
                    {{ $t('%1WP', { current: stepNumber.toString(), total: stepCount.toString() }) }}
                </p>

                <h1>
                    {{ $t('Controle') }}
                </h1>

                <!-- The file this step is about. What went wrong is about that file, so it is shown right below it. -->
                <div v-if="file" class="judicial-record-selected-file" data-testid="judicial-record-selected-file">
                    <STList>
                        <STListItem class="left-center" @contextmenu.prevent="showFileMenu">
                            <template #left>
                                <span :class="'icon ' + fileIcon" />
                            </template>

                            <h3 class="style-title-list" v-text="file.name" />
                            <p class="style-description-small">
                                {{ processingDescription ?? Formatter.fileSize(file.size) }}
                            </p>

                            <template v-if="processingDescription !== null || viewerFailed" #right>
                                <div class="judicial-record-selected-file-actions">
                                    <Spinner v-if="processingDescription !== null" data-testid="judicial-record-processing" />
                                    <!-- Only when the viewer cannot draw the document: otherwise it is right there -->
                                    <button v-if="viewerFailed" v-tooltip="openAction.label" class="button icon gray" :class="openAction.icon" type="button" :aria-label="openAction.label" data-testid="judicial-record-open-file" @click="openFile" />
                                </div>
                            </template>
                        </STListItem>
                    </STList>

                    <STErrorsDefault :error-box="errorBox" />
                </div>

                <p v-if="deliveryStatus === JudicialRecordDeliveryStatus.AutoOk" class="success-box icon success" data-testid="judicial-record-summary">
                    {{ $t('Opgeslagen & goedgekeurd') }}
                </p>

                <p v-else-if="deliveryStatus === JudicialRecordDeliveryStatus.Manual" class="warning-box icon clock" data-testid="judicial-record-summary">
                    {{ $t('Je attest wordt beoordeeld') }}
                </p>

                <!-- Next to the view there is a column for the extract. Without that room it stays here. -->
                <div v-if="pdfData && !previewWide && !viewerFailed" class="container">
                    <hr>
                    <JudicialRecordPdfPreview :data="pdfData" :in-column="false" :file-menu-items="fileMenuItems" @error="onViewerError" />
                </div>

                <template v-if="previewWide">
                    <hr>
                    <p class="style-button-bar right-align">
                        <LoadingButton v-for="action of actions" :key="action.key" :loading="action.loading">
                            <button class="button" :class="action.isPreferred ? 'primary' : 'secundary'" type="button" :disabled="action.disabled" :data-testid="action.testId" @click="action.handler">
                                <span>{{ action.label }}</span>
                            </button>
                        </LoadingButton>
                    </p>
                </template>
            </main>

            <!-- Without the column the extract is in the view, and would push the buttons off the screen -->
            <STToolbar v-if="!previewWide">
                <template #right>
                    <LoadingButton v-for="action of actions" :key="action.key" :loading="action.loading">
                        <button class="button" :class="action.isPreferred ? 'primary' : 'secundary'" type="button" :disabled="action.disabled" :data-testid="action.testId" @click="action.handler">
                            <span>{{ action.label }}</span>
                        </button>
                    </LoadingButton>
                </template>
            </STToolbar>
        </div>

        <template v-if="pdfData && previewWide && !viewerFailed" #preview>
            <JudicialRecordPdfPreview :data="pdfData" :in-column="true" :file-menu-items="fileMenuItems" @error="onViewerError" />
        </template>
    </PreviewPanel>
</template>

<script setup lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@common/errors';
import { Request } from '@common/networking';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';
import type { JudicialRecordCheckReport } from '@stamhoofd/structures';
import { JudicialRecordCheck, JudicialRecordCheckStatus, JudicialRecordDeliveryStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Spinner from '../Spinner.vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { usePreventLeave } from '../hooks/usePreventLeave';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import PreviewPanel from '../layout/PreviewPanel.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import LoadingButton from '../navigation/LoadingButton.vue';
import STToolbar from '../navigation/STToolbar.vue';
import { JudicialRecordCheckOutcome, getJudicialRecordCheckOutcome } from '../members/components/judicial-record/useJudicialRecordCheckTranslations';
import { useNavigationActions } from '../types/NavigationActions';
import JudicialRecordPdfPreview from './JudicialRecordPdfPreview.vue';
import type { JudicialRecordStepProps } from './JudicialRecordStepProps';
import { useDeliverJudicialRecord } from './useDeliverJudicialRecord';
import { JUDICIAL_RECORD_MAX_AGE_IN_DAYS, JUDICIAL_RECORD_MAX_PDF_SIZE } from './useJudicialRecordPdfSelection';

const props = defineProps<JudicialRecordStepProps>();

const navigate = useNavigationActions();
const deliverJudicialRecord = useDeliverJudicialRecord();

/** The file picked on the step before. That step moves on with every file, so this step is where it is judged. */
const file = props.delivery.file;

const isPdf = file?.type === 'application/pdf';

const fileIcon = isPdf ? 'file-pdf color-pdf' : (file?.type.startsWith('image/') ? 'file-image' : 'file');

/**
 * Where the file stopped. It is judged in three layers, each only once the one before holds:
 *
 * 1. `basic`: whether it is a pdf of a size an extract can have, and whether its bytes can be read.
 *    Nothing can be done with a file that fails here, other than picking another.
 * 2. `checks`: the checks of judicial-record-check, in the browser. A verdict the member disagrees
 *    with can still be sent in, for a reviewer to look at - not when the checks themselves broke,
 *    since then there is no verdict to disagree with.
 * 3. `backend`: it has the last word, and is the only one that can look up a revocation.
 */
type Failure =
    | { layer: 'basic' }
    | { layer: 'checks'; crashed: boolean }
    | { layer: 'backend'; reason: 'offline' | 'too-many-requests' | 'revoked' | 'other' };

const failure = ref<Failure | null>(null);

/** What the checks in the browser found, null while they run or when they could not run */
const report = ref<JudicialRecordCheckReport | null>(props.delivery.report);

/** What happens to the file right now: it is checked first and, when nothing needs fixing, sent in */
const processing = ref<'checking' | 'sending' | null>(null);

/**
 * The member asked for the running upload with a button. That button shows it is busy, and the
 * reason it was pressed for stays in view until the backend answers.
 */
const sendingOnRequest = ref(false);

/** Shown on the file row, together with a spinner, for what runs without the member asking for it */
const processingDescription = computed(() => {
    if (sendingOnRequest.value) {
        return null;
    }
    switch (processing.value) {
        case 'checking': return $t('Bezig met controleren…');
        case 'sending': return $t('Bezig met inzenden…');
        default: return null;
    }
});

const errorBox = ref<ErrorBox | null>(null);

/** The pdf the member is looking at, read from the file once it passed the basic checks */
const pdfData = ref<Uint8Array | null>(null);

const deliveryStatus = ref<JudicialRecordDeliveryStatus | null>(props.delivery.status);

/** Where FOD Justitie serves the document and until when, as the document itself prints it */
const extractUrl = ref<{ url: string; expiry: Date | null } | null>(null);

const previewWide = ref(false);

/**
 * The viewer could not draw this document. It says nothing about the checks - those ran on the same
 * bytes and have their own verdict - so the member is offered another way to look at it.
 */
const viewerFailed = ref(false);

function onViewerError(error: Error) {
    console.error(error);
    viewerFailed.value = true;
}

onMounted(() => {
    readFile().catch(console.error);
});

function failBasic(message: string) {
    failure.value = { layer: 'basic' };
    errorBox.value = new ErrorBox(new SimpleError({ code: 'invalid_field', message }));
}

/** Layer 1. Once it holds, the document is drawn while layer 2 runs. */
async function readFile() {
    if (file === null) {
        return;
    }

    // A scan or a photo of an extract can never be checked, the QR-code on it can
    if (!isPdf) {
        failBasic($t('Dit is geen pdf. Kies de pdf die je van FOD Justitie kreeg, of scan de QR-code op je uittreksel.'));
        return;
    }

    if (file.size > JUDICIAL_RECORD_MAX_PDF_SIZE) {
        failBasic($t('Dit bestand is te groot (maximaal {size}). Een uittreksel van FOD Justitie is veel kleiner, dus dit is wellicht niet het juiste bestand.', { size: Formatter.fileSize(JUDICIAL_RECORD_MAX_PDF_SIZE) }));
        return;
    }

    let data: Uint8Array;
    try {
        data = new Uint8Array(await file.arrayBuffer());
    } catch (error) {
        // The file was moved or deleted since it was picked, or the browser lost access to it
        console.error(error);
        failBasic($t('We konden dit bestand niet lezen. Kies het opnieuw, of scan de QR-code op je uittreksel.'));
        return;
    }

    pdfData.value = data;

    if (deliveryStatus.value !== null) {
        return;
    }

    if (report.value !== null) {
        judge(report.value);
        return;
    }

    await check(data);
}

/** Layer 2 */
async function check(data: Uint8Array) {
    processing.value = 'checking';
    errorBox.value = null;

    let result: JudicialRecordCheckReport;
    try {
        const outcome = await checkJudicialRecord({
            // pdf.js may transfer the buffer it is given to its worker, and the viewer still needs it
            data: data.slice(),
            firstName: props.member.patchedMember.details.firstName,
            lastName: props.member.patchedMember.details.lastName,
            birthDay: props.member.patchedMember.details.birthDay,
            maxAgeInDays: JUDICIAL_RECORD_MAX_AGE_IN_DAYS,
        });
        result = outcome.report;
        if (outcome.extract?.url) {
            extractUrl.value = { url: outcome.extract.url, expiry: outcome.extract.urlExpiry };
        }
    } catch (error) {
        // Not a verdict on the document, so there is nothing in it the member could act on
        console.error(error);
        errorBox.value = new ErrorBox(new SimpleError({
            code: 'judicial_record_check_crashed',
            message: $t('We konden dit document niet controleren. Probeer een ander document, of scan de QR-code op je uittreksel.'),
        }));
        failure.value = { layer: 'checks', crashed: true };
        return;
    } finally {
        processing.value = null;
    }

    report.value = result;
    props.delivery.report = result;

    if (judge(result)) {
        await deliver();
    }
}

/**
 * Whether the report lets the document through to the backend right away: nothing to fix, or only
 * that it is not blank, which a reviewer decides about either way. Otherwise the member decides.
 */
function judge(result: JudicialRecordCheckReport): boolean {
    const outcome = getJudicialRecordCheckOutcome(result);
    if (outcome === JudicialRecordCheckOutcome.Passed || outcome === JudicialRecordCheckOutcome.NotBlank) {
        return true;
    }

    failure.value = { layer: 'checks', crashed: false };
    errorBox.value = new ErrorBox(new SimpleError({
        code: 'judicial_record_check_failed',
        message: firstProblem(result) ?? $t('We konden je uittreksel niet automatisch goedkeuren.'),
    }));
    return false;
}

/**
 * Only the first thing that needs fixing is said. The checks are in the order in which they depend
 * on each other, so it is also the one to fix first. Not being blank is nothing to fix.
 */
function firstProblem(result: JudicialRecordCheckReport): string | null {
    const problem = result.getChecks().find(r => r.status !== JudicialRecordCheckStatus.Passed && !(r.check === JudicialRecordCheck.Blank && r.status === JudicialRecordCheckStatus.Failed));
    return problem?.reason || null;
}

function isTooManyRequests(error: unknown) {
    return (isSimpleError(error) || isSimpleErrors(error)) && (error.statusCode === 429 || error.hasCode('too_many_requests') || error.hasCode('rate_limit'));
}

/**
 * Layer 3: right away when nothing needs fixing, otherwise because the member asks for it. The
 * backend accepts every document and runs the same checks again, so it has the last word on whether
 * a person still has to look at it. The one thing it refuses is a revoked certificate.
 */
async function deliver({ onRequest = false } = {}) {
    if (file === null || processing.value !== null) {
        return;
    }

    processing.value = 'sending';
    sendingOnRequest.value = onRequest;
    if (!onRequest) {
        errorBox.value = null;
    }

    try {
        deliveryStatus.value = await deliverJudicialRecord(props.member.id, file);
        props.delivery.status = deliveryStatus.value;
        failure.value = null;
        errorBox.value = null;
    } catch (error) {
        errorBox.value = new ErrorBox(error);

        if ((isSimpleError(error) || isSimpleErrors(error)) && error.hasCode('certificate_revoked')) {
            failure.value = { layer: 'backend', reason: 'revoked' };
        } else if (isTooManyRequests(error)) {
            failure.value = { layer: 'backend', reason: 'too-many-requests' };
        } else if (Request.isNetworkError(error)) {
            failure.value = { layer: 'backend', reason: 'offline' };
        } else {
            failure.value = { layer: 'backend', reason: 'other' };
        }
    } finally {
        processing.value = null;
        sendingOnRequest.value = false;
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
 * The link FOD Justitie prints on the document, or else the one its QR-code held. It is only served
 * for a while: the document says until when, a scanned code does not.
 */
const externalUrl = computed(() => {
    const known = extractUrl.value ?? (props.delivery.url ? { url: props.delivery.url, expiry: null } : null);
    if (known === null) {
        return null;
    }

    // The printed date is the last day on which it is served
    if (known.expiry !== null && Date.now() >= known.expiry.getTime() + 24 * 60 * 60 * 1000) {
        return null;
    }
    return known.url;
});

/**
 * Another way to look at a document the viewer cannot draw. FOD Justitie's own page shows the
 * original; without it the browser shows the file itself. The app has no tabs, so there it is saved.
 */
const openAction = computed(() => {
    if (externalUrl.value !== null) {
        return { icon: 'external', label: $t('Openen bij FOD Justitie') };
    }
    if (!AppManager.shared.isNative) {
        return { icon: 'external', label: $t('Openen in nieuw tabblad') };
    }
    return { icon: 'download', label: $t('Downloaden') };
});

let objectUrl: string | null = null;

onBeforeUnmount(() => {
    if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
    }
});

function openOriginal(url: string) {
    window.open(url, '_blank');
}

function openInNewTab(file: File) {
    objectUrl ??= URL.createObjectURL(file);
    window.open(objectUrl, '_blank');
}

function download(file: File) {
    AppManager.shared.downloadFile(file, file.name).catch((error: unknown) => {
        errorBox.value = new ErrorBox(error);
    });
}

function openFile() {
    if (file === null) {
        return;
    }

    if (externalUrl.value !== null) {
        openOriginal(externalUrl.value);
    } else if (!AppManager.shared.isNative) {
        openInNewTab(file);
    } else {
        download(file);
    }
}

/** What can be done with the file, in the menu of its row and of the viewer */
const fileMenuItems = computed(() => {
    if (file === null) {
        return [];
    }

    const url = externalUrl.value;
    return [
        ...(AppManager.shared.isNative ? [] : [new ContextMenuItem({ name: $t('Openen in nieuw tabblad'), icon: 'external', action: () => openInNewTab(file) })]),
        ...(url === null ? [] : [new ContextMenuItem({ name: $t('Origineel bij FOD Justitie bekijken'), icon: 'government', action: () => openOriginal(url) })]),
        new ContextMenuItem({ name: $t('Downloaden'), icon: 'download', action: () => download(file) }),
    ];
});

function showFileMenu(event: MouseEvent) {
    new ContextMenu([fileMenuItems.value]).show({ clickEvent: event }).catch(console.error);
}

type Action = { key: string; label: string; isPreferred: boolean; disabled: boolean; loading: boolean; testId: string; handler: () => void };

function sendAction(label: string, isPreferred: boolean): Action {
    return {
        key: 'send',
        label,
        isPreferred,
        disabled: false,
        loading: sendingOnRequest.value,
        testId: 'judicial-record-send-anyway',
        handler: () => {
            deliver({ onRequest: true }).catch(console.error);
        },
    };
}

function otherDocumentAction(isPreferred: boolean): Action {
    return {
        key: 'other-document',
        label: $t('Ander document proberen'),
        isPreferred,
        disabled: processing.value !== null,
        loading: false,
        testId: 'judicial-record-retry-upload',
        handler: () => {
            deliverAgain().catch(console.error);
        },
    };
}

function closeAction(): Action {
    return {
        key: 'close',
        label: $t('Sluiten'),
        isPreferred: true,
        disabled: false,
        loading: false,
        testId: 'judicial-record-close',
        handler: () => {
            close().catch(console.error);
        },
    };
}

/** The buttons of the step, the preferred one last so it ends up on the right */
const actions = computed((): Action[] => {
    if (deliveryStatus.value !== null) {
        return [closeAction()];
    }

    // Whatever runs on its own: nothing to ask for until it answers. What the member asked for keeps
    // the buttons it was asked with.
    if (processing.value !== null && !sendingOnRequest.value) {
        return [otherDocumentAction(true)];
    }

    const current = failure.value;

    if (current === null || current.layer === 'basic') {
        return [otherDocumentAction(true)];
    }

    if (current.layer === 'checks') {
        return current.crashed
            ? [otherDocumentAction(true)]
            : [sendAction($t('Toch inzenden'), false), otherDocumentAction(true)];
    }

    switch (current.reason) {
        // Nothing is wrong with the document, only with the connection
        case 'offline': return [sendAction($t('Opnieuw proberen'), true)];

        // Trying again right away is exactly what is not allowed
        case 'too-many-requests': return [closeAction()];

        // The same document gets the same answer
        case 'revoked': return [otherDocumentAction(true)];

        case 'other': return [otherDocumentAction(false), sendAction($t('Opnieuw proberen'), true)];
    }
});

/**
 * Until the backend has the document, leaving loses it: the member would have to find and pick it
 * again. Not for a document that cannot be sent from here. The buttons of this step leave on
 * purpose and skip the question.
 */
const isUnsent = computed(() => {
    if (file === null || deliveryStatus.value !== null) {
        return false;
    }

    const current = failure.value;
    switch (current?.layer) {
        case undefined: return true;
        case 'basic': return false;
        case 'checks': return !current.crashed;
        case 'backend': return current.reason === 'offline' || current.reason === 'other';
    }
});

usePreventLeave(() => isUnsent.value ? $t('Je uittreksel is nog niet ingezonden.') : null);

async function shouldNavigateAway() {
    if (!isUnsent.value) {
        return true;
    }
    return await CenteredMessage.confirm({
        title: $t('Je uittreksel is nog niet ingezonden. Wil je toch stoppen?'),
        confirmText: $t('Stoppen'),
    });
}

defineExpose({ shouldNavigateAway });
</script>

<style lang="scss">
.judicial-record-control-view {
    .judicial-record-selected-file {
        margin-bottom: 15px;
    }

    .judicial-record-selected-file-actions {
        display: flex;
        align-items: center;
        gap: 10px;
    }
}
</style>

<template>
    <PreviewPanel v-model:wide="previewWide">
        <SaveView :title="$t('Beoordelen')" :loading="saving" :disabled="!canSave" :save-text="$t('Beoordeling opslaan')" class="judicial-record-review-view" @save="save">
            <h1>
                {{ $t('Uittreksel van {member} beoordelen', { member: memberName }) }}
            </h1>

            <p v-if="deliveredAt" class="style-description">
                {{ $t('Aangeleverd op {date}.', { date: Formatter.dateTime(deliveredAt) }) }}
            </p>

            <p v-if="!judicialRecord?.identityMatches" class="warning-box icon user">
                {{ $t('De naam of geboortedatum van dit lid is gewijzigd sinds dit uittreksel werd aangeleverd. Het zegt dus niets over wie dit lid nu is.') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <template v-if="documentMissing">
                <p class="error-box icon file">
                    {{ $t('Het document is niet meer beschikbaar, dus er is niets meer om te bekijken. Vraag het lid om een nieuw uittreksel aan te leveren.') }}
                </p>
            </template>

            <template v-else-if="!loadFailed">
                <hr>
                <h2>{{ $t('Automatische controle') }}</h2>

                <JudicialRecordCheckList :report="report" audience="reviewer" />

                <!-- Without the room for a column, the document is read right here. -->
                <div v-if="pdfData && !previewWide && !viewerFailed" class="container">
                    <hr>
                    <JudicialRecordPdfPreview :data="pdfData" :in-column="false" :file-menu-items="fileMenuItems" @error="onViewerError" />
                </div>

                <p v-if="viewerFailed" class="warning-box icon file">
                    {{ $t('We konden dit document niet weergeven. Download het om het te bekijken.') }}
                </p>

                <hr>
                <h2>{{ $t('Beoordeling') }}</h2>

                <STList>
                    <STListItem v-for="outcome of judicialRecordReviewOutcomes" :key="outcome" :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="reviewDecision" :value="outcome" name="judicial-record-outcome" />
                        </template>

                        <h3 class="style-title-list">
                            {{ JudicialRecordHelper.getReviewDecisionName(outcome) }}
                        </h3>
                        <p class="style-description-small">
                            {{ getOutcomeDescription(outcome) }}
                        </p>
                    </STListItem>
                </STList>

                <STInputBox error-fields="comment" :error-box="errors.errorBox" :title="commentTitle">
                    <textarea v-model="comment" class="input" :placeholder="commentPlaceholder" :maxlength="JUDICIAL_RECORD_MAX_COMMENT_LENGTH" data-testid="judicial-record-comment" />
                </STInputBox>

                <p class="style-description-small">
                    {{ $t('Het document wordt verwijderd zodra je de beoordeling opslaat. Enkel je beoordeling en je opmerking blijven bewaard.') }}
                </p>
            </template>
        </SaveView>

        <template v-if="pdfData && previewWide && !viewerFailed" #preview>
            <JudicialRecordPdfPreview :data="pdfData" :in-column="true" :file-menu-items="fileMenuItems" @error="onViewerError" />
        </template>
    </PreviewPanel>
</template>

<script setup lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@common/errors';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';
import type { JudicialRecordCheckReport, PlatformMember } from '@stamhoofd/structures';
import { JUDICIAL_RECORD_MAX_COMMENT_LENGTH, JudicialRecordHelper, JudicialRecordReviewDecision, judicialRecordReviewOutcomes } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useErrors } from '../errors/useErrors';
import Radio from '../inputs/Radio.vue';
import STInputBox from '../inputs/STInputBox.vue';
import PreviewPanel from '../layout/PreviewPanel.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import SaveView from '../navigation/SaveView.vue';
import { ContextMenuItem } from '../overlays/ContextMenu';
import JudicialRecordCheckList from '../members/components/judicial-record/JudicialRecordCheckList.vue';
import { useNavigationActions } from '../types/NavigationActions';
import JudicialRecordPdfPreview from './JudicialRecordPdfPreview.vue';
import { JUDICIAL_RECORD_MAX_AGE_IN_DAYS } from './useJudicialRecordPdfSelection';
import { useJudicialRecordDocument, useJudicialRecordReviewView, useSubmitJudicialRecordReview } from './useJudicialRecordReview';

const props = defineProps<{
    member: PlatformMember;
}>();

const navigate = useNavigationActions();
const errors = useErrors();
const fetchDocument = useJudicialRecordDocument();
const fetchReviewView = useJudicialRecordReviewView();
const submitReview = useSubmitJudicialRecordReview();

const memberName = props.member.patchedMember.firstName;
const judicialRecord = computed(() => props.member.patchedMember.judicialRecord);

const reviewDecision = ref<JudicialRecordReviewDecision | null>(null);
const comment = ref('');
const saving = ref(false);

/** The document gets a column of its own when the window is wide enough, as in the delivery flow. */
const previewWide = ref(false);

const pdfData = ref<Uint8Array | null>(null);
const report = ref<JudicialRecordCheckReport | null>(null);
const deliveredAt = ref<Date | null>(null);
const documentMissing = ref(false);
const viewerFailed = ref(false);

/** Set when the screen could not load what there is to judge, which is not the same as there being nothing. */
const loadFailed = ref(false);

const canSave = computed(() => reviewDecision.value !== null && !documentMissing.value && !loadFailed.value);

/** A condition is the point of a conditional acceptance, so it is asked for rather than offered. */
const isConditional = computed(() => reviewDecision.value === JudicialRecordReviewDecision.ConditionallyAccepted);

const commentTitle = computed(() => isConditional.value ? $t('Voorwaarden') : $t('Opmerking'));

const commentPlaceholder = computed(() => isConditional.value
    ? $t('Onder welke voorwaarden dit lid mag werken met minderjarigen')
    : $t('Optioneel, enkel zichtbaar voor beheerders'));

function getOutcomeDescription(outcome: JudicialRecordReviewDecision): string {
    switch (outcome) {
        case JudicialRecordReviewDecision.Ok:
            return $t('Dit lid mag werken met minderjarigen.');
        case JudicialRecordReviewDecision.ConditionallyAccepted:
            return $t('Dit lid mag werken met minderjarigen, onder de voorwaarden die je hieronder schrijft.');
        case JudicialRecordReviewDecision.TemporarilyRejected:
            return $t('Dit lid mag niet werken met minderjarigen en levert een nieuw uittreksel aan.');
        case JudicialRecordReviewDecision.PermanentlyRejected:
            return $t('Dit lid mag niet werken met minderjarigen.');
        case JudicialRecordReviewDecision.UnderReview:
            return '';
    }
}

/**
 * Only offered once the viewer could not draw the document, never on the normal path.
 *
 * The extract is deleted the moment a decision is recorded, which is what the member is promised; a menu that
 * invites every reviewer to keep a copy of every document they open would make that promise about our storage
 * rather than about the document. A reviewer who cannot see it at all still has to be able to do their job.
 */
const fileMenuItems = computed((): ContextMenuItem[] => {
    const file = documentFile.value;

    if (file === null || !viewerFailed.value) {
        return [];
    }

    return [
        ...(AppManager.shared.isNative ? [] : [new ContextMenuItem({ name: $t('Openen in nieuw tabblad'), icon: 'external', action: () => openInNewTab(file) })]),
        new ContextMenuItem({ name: $t('Downloaden'), icon: 'download', action: () => download(file) }),
    ];
});

const documentFile = computed((): File | null => {
    return pdfData.value === null ? null : new File([pdfData.value as BlobPart], 'uittreksel.pdf', { type: 'application/pdf' });
});

let objectUrl: string | null = null;

onBeforeUnmount(() => {
    if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
    }
});

function openInNewTab(file: File) {
    objectUrl ??= URL.createObjectURL(file);
    window.open(objectUrl, '_blank');
}

function download(file: File) {
    AppManager.shared.downloadFile(file, file.name).catch((error: unknown) => {
        errors.errorBox = new ErrorBox(error);
    });
}

onMounted(() => {
    load().catch(console.error);
});

/**
 * One request for what was decided before, one for the bytes, and then the checks on those bytes.
 *
 * The checks run here rather than being read back from the record: nothing stores them. They are cheap - a
 * couple of milliseconds for a document - but they are run one after the other and never with `Promise.all`,
 * which turns the short stalls of a handful of documents into one long block of the main thread.
 */
async function load() {
    try {
        await fetchAndCheck();
    } catch (error) {
        // Saving a decision deletes the extract, so a reviewer may not record one for a document they never
        // saw: until this screen is reopened there is nothing to decide with.
        loadFailed.value = true;
        errors.errorBox = new ErrorBox(error);
    }
}

async function fetchAndCheck() {
    const view = await fetchReviewView(props.member.id);

    deliveredAt.value = view.deliveredAt;
    reviewDecision.value = view.reviewDecision === JudicialRecordReviewDecision.UnderReview ? null : view.reviewDecision;
    comment.value = view.reviewDetails?.comment ?? '';

    if (!view.hasDocument) {
        documentMissing.value = true;
        return;
    }

    let data: Uint8Array;

    try {
        data = await fetchDocument(props.member.id);
    } catch (error) {
        if ((isSimpleError(error) || isSimpleErrors(error)) && error.hasCode('judicial_record_document_removed')) {
            // Retention got there first: nothing left to judge, which the reviewer is told rather than shown
            documentMissing.value = true;
            return;
        }
        throw error;
    }

    pdfData.value = data;

    try {
        const outcome = await checkJudicialRecord({
            // pdf.js may transfer the buffer it is given to its worker, and the viewer still needs it
            data: data.slice(),
            firstName: props.member.patchedMember.details.firstName,
            lastName: props.member.patchedMember.details.lastName,
            birthDay: props.member.patchedMember.details.birthDay,
            maxAgeInDays: JUDICIAL_RECORD_MAX_AGE_IN_DAYS,

            // Judged on the day it was handed in. An extract that waited a fortnight for a reviewer was not
            // out of date when the member delivered it, and that is the question the age check answers.
            atDate: view.deliveredAt,
        });

        report.value = outcome.report;
    } catch (error) {
        // Not a verdict on the document: the reviewer reads it themselves, which is what they are here for
        console.error(error);
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'judicial_record_check_crashed',
            message: $t('We konden de automatische controle niet uitvoeren. Beoordeel het document zelf.'),
        }));
    }
}

function onViewerError(error: Error) {
    console.error(error);
    viewerFailed.value = true;
}

async function save() {
    if (saving.value || reviewDecision.value === null) {
        return;
    }

    if (isConditional.value && comment.value.trim().length === 0) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            field: 'comment',
            message: $t('Schrijf op onder welke voorwaarden dit lid mag werken met minderjarigen.'),
        }));
        return;
    }

    saving.value = true;
    errors.errorBox = null;

    try {
        const blob = await submitReview(props.member.id, reviewDecision.value, comment.value.trim() || null);

        props.member.family.insertFromBlob(blob);
        await navigate.dismiss({ force: true });
    } catch (error) {
        errors.errorBox = new ErrorBox(error);
    } finally {
        saving.value = false;
    }
}
</script>

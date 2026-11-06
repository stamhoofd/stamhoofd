<template>
    <div class="st-view judicial-record-result-view">
        <STNavigationBar :title="$t('Controle')" />

        <main>
            <p class="style-title-prefix">
                {{ $t('%1WP', { current: stepNumber.toString(), total: stepCount.toString() }) }}
            </p>

            <h1>
                {{ $t('Controle') }}
            </h1>

            <template v-if="errors.errorBox">
                <STErrorsDefault :error-box="errors.errorBox" />

                <p class="style-button-bar right-align">
                    <button class="button secondary" type="button" data-testid="judicial-record-retry-upload" @click="deliverAgain">
                        <span>{{ $t('Ander bestand kiezen') }}</span>
                    </button>
                    <LoadingButton :loading="delivering">
                        <button class="button primary" type="button" data-testid="judicial-record-retry" @click="deliver">
                            <span>{{ $t('Opnieuw proberen') }}</span>
                        </button>
                    </LoadingButton>
                </p>
            </template>

            <JudicialRecordCheckList v-else :report="report">
                <template #actions>
                    <template v-if="outcome === JudicialRecordCheckOutcome.Failed">
                        <!-- Sending it in anyway keeps the document for a reviewer, and nothing is kept yet: it arrives with the review flow. -->
                        <button class="button secondary" type="button" disabled data-testid="judicial-record-send-anyway">
                            <span>{{ $t('Toch inzenden') }}</span>
                        </button>

                        <button class="button primary" type="button" data-testid="judicial-record-retry-upload" @click="deliverAgain">
                            <span>{{ $t('Opnieuw uploaden') }}</span>
                        </button>
                    </template>

                    <button v-else class="button primary" type="button" data-testid="judicial-record-close" @click="close">
                        <span>{{ $t('Sluiten') }}</span>
                    </button>
                </template>
            </JudicialRecordCheckList>
        </main>
    </div>
</template>

<script setup lang="ts">
import type { JudicialRecordCheckReport } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useErrors } from '../errors/useErrors';
import LoadingButton from '../navigation/LoadingButton.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import JudicialRecordCheckList from '../members/components/judicial-record/JudicialRecordCheckList.vue';
import { JudicialRecordCheckOutcome, getJudicialRecordCheckOutcome } from '../members/components/judicial-record/useJudicialRecordCheckTranslations';
import { useNavigationActions } from '../types/NavigationActions';
import type { JudicialRecordStepProps } from './JudicialRecordStepProps';
import { useDeliverJudicialRecord } from './useDeliverJudicialRecord';

const props = defineProps<JudicialRecordStepProps>();

const navigate = useNavigationActions();
const errors = useErrors();
const deliverJudicialRecord = useDeliverJudicialRecord();

/** Null while the control is running, which is what the checklist shows its spinner for. */
const report = ref<JudicialRecordCheckReport | null>(null);
const delivering = ref(false);

const outcome = computed(() => report.value === null ? null : getJudicialRecordCheckOutcome(report.value));

/**
 * The control starts as soon as this step opens, not when the member picked the file, so the
 * spinner is on the screen for exactly as long as the request runs.
 */
onMounted(() => {
    deliver().catch(console.error);
});

async function deliver() {
    const file = props.delivery.file;

    if (file === null || delivering.value) {
        // Only reachable by the delivery step, which always puts the chosen file in here first.
        return;
    }

    delivering.value = true;
    errors.errorBox = null;
    report.value = null;

    try {
        report.value = await deliverJudicialRecord(props.member.id, file);
    }
    catch (error) {
        // A report of failed checks is an answer, not an error: only a request that never got one
        // lands here - no connection, a rate limit, a file the server would not even read.
        errors.errorBox = new ErrorBox(error);
    }
    finally {
        delivering.value = false;
    }
}

/** Back to the delivery step, which is the step right below this one, with nothing selected. */
async function deliverAgain() {
    await navigate.pop({ force: true });
}

async function close() {
    await props.dismissHandler(navigate);
}
</script>

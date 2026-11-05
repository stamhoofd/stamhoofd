<template>
    <div class="judicial-record-check-list">
        <STList>
            <JudicialRecordCheckRow
                v-for="row in rows"
                :key="row.result.check"
                :result="row.result"
                :reason="row.reason"
            />
        </STList>

        <p v-if="report === null" class="loading-box">
            <Spinner />
            {{ $t('We controleren je uittreksel...') }}
        </p>

        <template v-else>
            <p class="icon" :class="[boxClass, boxIcon]">
                <span>
                    <strong>{{ outcomeTitle }}</strong>
                    <span>{{ outcomeDescription }}</span>
                </span>
            </p>

            <div v-if="$slots.actions" class="style-button-bar right-align">
                <slot name="actions" />
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import Spinner from '#Spinner.vue';
import STList from '#layout/STList.vue';
import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, judicialRecordChecksInOrder } from '@stamhoofd/structures';
import { computed } from 'vue';
import JudicialRecordCheckRow from './JudicialRecordCheckRow.vue';
import type { JudicialRecordCheckAudience } from './useJudicialRecordCheckTranslations';
import { JudicialRecordCheckOutcome, getJudicialRecordCheckOutcome, useJudicialRecordCheckTranslations } from './useJudicialRecordCheckTranslations';

const props = withDefaults(
    defineProps<{
        /** The automatic control, or null while the request that produces it is still running. */
        report: JudicialRecordCheckReport | null;
        audience?: JudicialRecordCheckAudience;
    }>(),
    {
        audience: 'member',
    },
);

const { getTitle } = useJudicialRecordCheckTranslations();

/** Whether the record is blank is between the member and a reviewer, so only one of them sees it. */
const isReviewer = computed(() => props.audience === 'reviewer');

/**
 * While the request runs we have no results yet, so the checks we are about to run are listed
 * without a verdict. The rows are the same ones that will carry the answer, so nothing jumps.
 */
const checks = computed((): JudicialRecordCheckResult[] => {
    if (props.report === null) {
        return visibleChecks.value.map(check => JudicialRecordCheckResult.create({ check, status: JudicialRecordCheckStatus.Pending }));
    }

    return props.report.getChecks(isReviewer.value);
});

/**
 * The same sentence is only said once. When a signature does not hold, the four content checks are
 * all pending for that one reason, and the backend puts that reason on each of them - it has no way
 * to know they will end up under each other in a list. Printing it four times would read as four
 * problems.
 */
const rows = computed((): { result: JudicialRecordCheckResult; reason: string | null }[] => {
    const said = new Set<string>();

    return checks.value.map((result) => {
        const reason = result.reason !== '' && !said.has(result.reason) ? result.reason : null;
        said.add(result.reason);

        return { result, reason };
    });
});

const visibleChecks = computed((): JudicialRecordCheck[] => {
    return isReviewer.value
        ? [...judicialRecordChecksInOrder]
        : judicialRecordChecksInOrder.filter(check => check !== JudicialRecordCheck.Blank);
});

const outcome = computed(() => props.report === null ? null : getJudicialRecordCheckOutcome(props.report));

const boxClass = computed(() => {
    switch (outcome.value) {
        case JudicialRecordCheckOutcome.Passed: return 'success-box';
        case JudicialRecordCheckOutcome.NotBlank: return 'warning-box';
        case JudicialRecordCheckOutcome.Failed: return 'error-box';
        default: return 'info-box';
    }
});

const boxIcon = computed(() => {
    switch (outcome.value) {
        case JudicialRecordCheckOutcome.Passed: return 'success';
        case JudicialRecordCheckOutcome.NotBlank: return 'clock';
        case JudicialRecordCheckOutcome.Failed: return 'warning';
        default: return 'clock';
    }
});

const outcomeTitle = computed(() => {
    switch (outcome.value) {
        case JudicialRecordCheckOutcome.Passed:
            return isReviewer.value
                ? $t('Het uittreksel is automatisch goedgekeurd')
                : $t('Je uittreksel is goedgekeurd');

        case JudicialRecordCheckOutcome.NotBlank:
            return isReviewer.value
                ? $t('In de wachtrij omdat het niet blanco is')
                : $t('Je uittreksel wordt beoordeeld');

        case JudicialRecordCheckOutcome.Failed: {
            if (!isReviewer.value) {
                return $t('We konden je uittreksel niet automatisch goedkeuren');
            }

            const failed = failedCheck.value;
            return failed
                ? $t('Automatisch afgekeurd op {check}', { check: getTitle(failed.check) })
                : $t('Automatisch afgekeurd');
        }

        default:
            return isReviewer.value
                ? $t('De automatische controle is nog niet afgerond')
                : $t('We konden je uittreksel nog niet volledig controleren');
    }
});

const outcomeDescription = computed(() => {
    switch (outcome.value) {
        case JudicialRecordCheckOutcome.Passed:
            return isReviewer.value
                ? $t('Alle automatische checks slaagden en het strafregister is blanco.')
                : $t('Je document is meteen verwijderd. We bewaren enkel dat het gecontroleerd is en wanneer.');

        case JudicialRecordCheckOutcome.NotBlank:
            return isReviewer.value
                ? $t('Alle andere automatische checks slaagden. Bekijk het document en ken een status toe.')
                : $t('Een controleur van de koepel bekijkt het en neemt indien nodig contact met je op. Je document wordt verwijderd zodra het beoordeeld is.');

        case JudicialRecordCheckOutcome.Failed:
            return isReviewer.value
                ? $t('Bekijk het document en ken een status toe.')
                : $t('Controleer of je het juiste document hebt aangeleverd en of je gegevens kloppen. Klopt alles toch? Stuur het dan in: een controleur van de koepel bekijkt het.');

        // Nothing here promises another attempt: a check without a verdict is one we are waiting
        // on as well as one that could not be performed at all, and the report does not say which.
        default:
            return isReviewer.value
                ? $t('Eén of meer checks hebben nog geen resultaat.')
                : $t('Lees bij de checks hierboven wat er nog ontbreekt.');
    }
});

/** The check the rejection is on. There is one whenever the outcome is a rejection. */
const failedCheck = computed((): JudicialRecordCheckResult | null => {
    return props.report?.failedChecks.find(result => result.check !== JudicialRecordCheck.Blank) ?? null;
});
</script>

<style lang="scss">
.judicial-record-check-list {
    > .success-box,
    > .error-box,
    > .warning-box,
    > .info-box {
        strong {
            display: block;
        }
    }
}
</style>

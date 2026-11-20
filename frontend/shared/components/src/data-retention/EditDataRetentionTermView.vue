<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ title }}</h1>
        <p>{{ texts.start }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div v-if="pendingTerms && pendingFrom" class="info-box">
            {{ $t('Er wacht een wijziging naar ‘{terms}’. Ze gaat in op {date}.', { terms: getDataRetentionTermsSummary(pendingTerms).toLocaleLowerCase(), date: formatDate(pendingFrom) }) }}
            <button class="button text" type="button" :disabled="cancelling" @click="cancelPendingChange">
                {{ $t('Wijziging annuleren') }}
            </button>
        </div>

        <template v-if="capabilities.anonymize">
            <hr>
            <h2>{{ $t('Anonimiseren') }}</h2>
            <Checkbox v-model="anonymizeEnabled" data-testid="data-retention-anonymize">
                {{ $t('Anonimiseren na') }}
            </Checkbox>
            <STInputBox v-if="anonymizeEnabled" error-fields="anonymizeAfterMonths" :error-box="errors.errorBox">
                <DataRetentionMonthsInput v-model="anonymizeAfterMonths" />
            </STInputBox>
            <p v-else-if="platformTerms?.anonymizeAfterMonths" class="style-description-small">
                {{ $t('Geen eigen termijn. Nu geldt de termijn van de koepel: {term}.', { term: formatDataRetentionMonths(platformTerms.anonymizeAfterMonths) }) }}
            </p>
            <p v-if="texts.cannotDelete" class="style-description-small">
                {{ texts.cannotDelete }}
            </p>
        </template>

        <template v-if="capabilities.delete">
            <hr>
            <h2>{{ $t('Verwijderen') }}</h2>
            <Checkbox v-model="deleteEnabled" data-testid="data-retention-delete">
                {{ $t('Verwijderen na') }}
            </Checkbox>
            <STInputBox v-if="deleteEnabled" error-fields="deleteAfterMonths" :error-box="errors.errorBox">
                <DataRetentionMonthsInput v-model="deleteAfterMonths" data-testid="data-retention-delete-input" />
            </STInputBox>
            <p v-else-if="platformTerms?.deleteAfterMonths" class="style-description-small">
                {{ $t('Geen eigen termijn. Nu geldt de termijn van de koepel: {term}.', { term: formatDataRetentionMonths(platformTerms.deleteAfterMonths) }) }}
            </p>
            <p v-if="category === DataRetentionCategory.Members" class="style-description-small">
                {{ $t('Een lid met een huidige of toekomstige aansluiting, of een aansluiting die nog aangerekend moet worden, wordt ook niet verwijderd. Verwijderen kan dus later gebeuren dan de termijn.') }}
            </p>
            <p v-if="texts.cannotAnonymize" class="style-description-small">
                {{ texts.cannotAnonymize }}
            </p>
        </template>

        <template v-if="capabilities.protectedPeriods">
            <hr>
            <h2>{{ $t('Recente leden beschermen') }}</h2>
            <Checkbox v-model="protectedPeriodsEnabled" data-testid="data-retention-protected-periods">
                {{ $t('Leden met recente inschrijvingen of aansluitingen niet anonimiseren of verwijderen') }}
            </Checkbox>
            <STInputBox v-if="protectedPeriodsEnabled" error-fields="protectedPeriods" :error-box="errors.errorBox">
                <NumberInput v-model="protectedPeriods" :min="1" :suffix="$t('laatste werkjaren')" :suffix-singular="$t('laatste werkjaar')" />
            </STInputBox>
            <p v-else-if="platformTerms?.protectedPeriods" class="style-description-small">
                {{ $t('Geen eigen aantal. Nu geldt het aantal van de koepel: de laatste {count} werkjaren. Past de koepel dit aan, dan volgen jullie mee, tenzij jullie zelf een aantal invullen.', { count: platformTerms.protectedPeriods }) }}
            </p>
            <p class="style-description-small">
                {{ $t('Het huidige werkjaar telt mee. Bij 2 is dat dus het huidige en het vorige werkjaar. Deze leden blijven bewaard, ook als de termijn al verstreken is. Een korte termijn kan daardoor pas later effect hebben. Gevoelige gegevens en documenten volgen hun eigen termijn.') }}
            </p>
        </template>

        <p v-for="conflict of conflicts" :key="conflict" class="warning-box">
            {{ conflict }}
        </p>

        <p class="style-description-small">
            {{ $t('Minimum {minimum} maanden. Alles waardoor gegevens vroeger verwerkt worden, ook een eerste termijn, gaat pas na {days} dagen in. Een langere termijn geldt meteen.', { minimum: DATA_RETENTION_MINIMUM_MONTHS, days: DATA_RETENTION_WAITING_DAYS }) }}
        </p>

        <hr>
        <h2>{{ $t('Wat er gebeurt') }}</h2>
        <STList>
            <STListItem v-for="effect of texts.effects" :key="effect.label">
                <h3 class="style-title-list">
                    {{ effect.label }}
                </h3>
                <p class="style-description-small">
                    {{ effect.text }}
                </p>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@browser/navigation';
import { Toast } from '@stamhoofd/frontend-notifications/Toast';
import type { DataRetentionPolicy, DataRetentionSettings } from '@stamhoofd/structures';
import {
    DATA_RETENTION_DEFAULT_PROTECTED_PERIODS,
    DATA_RETENTION_MINIMUM_MONTHS,
    DATA_RETENTION_WAITING_DAYS,
    DataRetentionCategory,
    DataRetentionTerms,
    formatDataRetentionMonths,
    getDataRetentionCapabilities,
    getDataRetentionCategoryName,
    getDataRetentionConflicts,
    getDataRetentionPreviewMessage,
    getDataRetentionTermsSummary,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

import { useFreshAction } from '#auth/useFreshAction.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useRequestOwner } from '#hooks/networking/useRequestOwner';
import { useContext } from '#hooks/useContext.ts';
import Checkbox from '#inputs/Checkbox.vue';
import NumberInput from '#inputs/NumberInput.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import SaveView from '#navigation/SaveView.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { cancelPendingDataRetentionChange, previewDataRetentionTerms, saveDataRetentionTerms } from './dataRetentionRequests';
import DataRetentionMonthsInput from './DataRetentionMonthsInput.vue';
import { getDataRetentionCategoryTexts } from './dataRetentionTexts';

const props = defineProps<{
    policy: DataRetentionPolicy;
    /**
     * Only for an organization within a platform.
     */
    platformPolicy: DataRetentionPolicy | null;
    onSaved: (settings: DataRetentionSettings) => void;
}>();

const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const pop = usePop();
const runFresh = useFreshAction();

const now = new Date();
const category = props.policy.category;
const title = getDataRetentionCategoryName(category);
const texts = getDataRetentionCategoryTexts(category);
const capabilities = getDataRetentionCapabilities(category);
const platformTerms = props.platformPolicy?.getActiveTerms(now) ?? null;

const pendingFrom = ref(props.policy.pendingFrom && props.policy.pendingFrom > now ? props.policy.pendingFrom : null);
const pendingTerms = ref(pendingFrom.value ? props.policy.pendingTerms : null);

// A waiting change is what was chosen last, so the form starts from it
const initial = pendingTerms.value ?? props.policy.getActiveTerms(now);
const anonymizeAfterMonths = ref(initial.anonymizeAfterMonths);
const deleteAfterMonths = ref(initial.deleteAfterMonths);
const protectedPeriods = ref(initial.protectedPeriods);

const saving = ref(false);
const cancelling = ref(false);

const terms = computed(() => DataRetentionTerms.create({
    anonymizeAfterMonths: capabilities.anonymize ? anonymizeAfterMonths.value : null,
    deleteAfterMonths: capabilities.delete ? deleteAfterMonths.value : null,
    protectedPeriods: capabilities.protectedPeriods ? protectedPeriods.value : null,
}));
const hasChanges = computed(() => !terms.value.isSameAs(initial));
const conflicts = computed(() => getDataRetentionConflicts(platformTerms, terms.value));

/**
 * Turning a term on starts from the term of the platform, so the organization sees what applies now.
 */
function useEnabled(value: typeof anonymizeAfterMonths, getDefault: () => number) {
    return computed({
        get: () => value.value !== null,
        set: (enabled: boolean) => {
            value.value = enabled ? getDefault() : null;
        },
    });
}
const anonymizeEnabled = useEnabled(anonymizeAfterMonths, () => platformTerms?.anonymizeAfterMonths ?? 24);
const deleteEnabled = useEnabled(deleteAfterMonths, () => platformTerms?.deleteAfterMonths ?? Math.max(anonymizeAfterMonths.value ?? 0, 60));
const protectedPeriodsEnabled = useEnabled(protectedPeriods, () => platformTerms?.protectedPeriods ?? DATA_RETENTION_DEFAULT_PROTECTED_PERIODS);

function formatDate(date: Date) {
    return Formatter.date(date, true);
}

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;
    try {
        terms.value.validate(category);

        const message = await getConfirmation();
        if (message && !await CenteredMessage.confirm({ ...message, confirmText: $t('Termijn opslaan'), destructive: true, availabilityDelay: 2_000 })) {
            saving.value = false;
            return;
        }

        const settings = await runFresh(() => saveDataRetentionTerms(context.value, owner, category, terms.value));
        props.onSaved(settings);

        const saved = settings.policies.find(p => p.category === category);
        if (saved?.pendingFrom && saved.pendingFrom > new Date()) {
            Toast.info($t('De wijziging gaat in op {date}. Tot dan kan je ze nog annuleren.', { date: formatDate(saved.pendingFrom) })).show();
        }
        else {
            Toast.success($t('De bewaartermijn is gewijzigd.')).show();
        }
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

/**
 * A preview that fails should not block saving: then the confirmation explains the waiting time without numbers.
 */
async function getConfirmation() {
    try {
        return getDataRetentionPreviewMessage(await previewDataRetentionTerms(context.value, owner, category, terms.value));
    }
    catch (e) {
        console.error(e);
        return {
            title: $t('Termijn opslaan?'),
            description: $t('We konden niet nagaan hoeveel gegevens deze wijziging raakt. Een kortere termijn gaat pas na {days} dagen in, en het overzicht toont de aantallen na de volgende nachtelijke telling.', { days: DATA_RETENTION_WAITING_DAYS }),
        };
    }
}

async function cancelPendingChange() {
    if (cancelling.value) {
        return;
    }
    cancelling.value = true;
    errors.errorBox = null;
    try {
        const settings = await cancelPendingDataRetentionChange(context.value, owner, category);
        props.onSaved(settings);
        Toast.success($t('De geplande wijziging is geannuleerd.')).show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    cancelling.value = false;
}
</script>

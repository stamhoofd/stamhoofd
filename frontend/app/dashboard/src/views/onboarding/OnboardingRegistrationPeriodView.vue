<template>
    <SaveView :title="title" :save-text="$t('Volgende')" save-icon-right="arrow-right" :loading="saving" :prefer-large-button="true" @save="goNext">
        <aside class="style-title-prefix">
            {{ $t('Stap {current} van {total}', { current: props.stepNumber.toString(), total: props.stepCount.toString() }) }}
        </aside>
        <h1>
            {{ title }}
        </h1>
        <p>
            {{ $t('Je kan dit later aanpassen en meerdere werkjaren aanmaken.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="configType" value="year" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('Per werkjaar') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Een volledig jaar, met een vaste startmaand.') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="configType" value="semester" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('Per semester') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Schooljaar opgedeeld in twee semesters.') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="configType" value="custom" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('Aangepast') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Kies zelf een begin- en einddatum.') }}
                </p>
            </STListItem>
        </STList>

        <STInputBox v-if="configType === 'year'" :title="$t('In welke maand start jullie werkjaar?')" class="max">
            <Dropdown v-model="startMonth">
                <option v-for="month in 12" :key="month" :value="month - 1">
                    {{ capitalizeFirstLetter(Formatter.month(month)) }}
                </option>
            </Dropdown>
        </STInputBox>

        <STInputBox v-if="configType === 'semester'" :title="$t('Welk semester?')" class="max">
            <Dropdown v-model="semester">
                <option :value="1">
                    {{ $t('Eerste semester (september - januari)') }}
                </option>
                <option :value="2">
                    {{ $t('Tweede semester (februari - mei)') }}
                </option>
            </Dropdown>
        </STInputBox>

        <div v-if="configType === 'custom'" class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t('Startdatum')">
                <DateSelection v-model="customStartDate" :time="{ hours: 0, minutes: 0, seconds: 0 }" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t('Einddatum')">
                <DateSelection v-model="customEndDate" :time="{ hours: 23, minutes: 59, seconds: 59 }" :min="customStartDate" />
            </STInputBox>
        </div>

        <p class="style-description-small">
            {{ Formatter.dateRange(effectiveStart, effectiveEnd) }} ({{ previewName }})
        </p>
    </SaveView>
</template>

<script setup lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { useRequestOwner } from '@stamhoofd/networking';
import { RegistrationPeriod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';
import type { OnboardingStepProps } from './useMemberAdministrationOnboarding';
import { clearOrganizationPeriodsCache } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods';

type ConfigType = 'year' | 'semester' | 'custom';

const props = defineProps<OnboardingStepProps>();
const navigationActions = useNavigationActions();
const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const saving = ref(false);

const title = $t('Wanneer start jullie werkjaar?');

const period = props.viewModel.period.period;

const initialMonths = (period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

// Default to a year based configuration for long periods, otherwise start from the existing dates.
const configType = ref<ConfigType>(initialMonths > 7 ? 'year' : 'custom');
const startMonth = ref<number>(Formatter.luxon(period.startDate).month - 1);
const semester = ref<1 | 2>(1);
const customStartDate = ref<Date>(new Date(period.startDate.getTime()));
const customEndDate = ref<Date>(new Date(period.endDate.getTime()));

function capitalizeFirstLetter(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The year based period: a full year starting on the chosen month. The year is picked so the
 * period contains today (the most recent occurrence of that start month). All dates are built
 * in the timezone configured in Formatter.
 */
function yearDates(month: number): { start: Date; end: Date } {
    const luxonMonth = month + 1; // Formatter/luxon months are 1-based
    const now = Formatter.luxon();
    const year = now.month >= luxonMonth ? now.year : now.year - 1;
    const start = Formatter.luxon().set({ year, month: luxonMonth, day: 1 }).startOf('day');
    const end = start.plus({ years: 1 }).minus({ days: 1 }).endOf('day');
    return { start: start.toJSDate(), end: end.toJSDate() };
}

/**
 * School semester period within the current academic year (which starts in September).
 * 1st semester: September - January, 2nd semester: February - May. Built in the timezone
 * configured in Formatter.
 */
function semesterDates(value: 1 | 2): { start: Date; end: Date } {
    const now = Formatter.luxon();
    const academicStartYear = now.month >= 9 ? now.year : now.year - 1;

    if (value === 1) {
        return {
            start: Formatter.luxon().set({ year: academicStartYear, month: 9, day: 1 }).startOf('day').toJSDate(), // 1 September
            end: Formatter.luxon().set({ year: academicStartYear + 1, month: 1, day: 1 }).endOf('month').toJSDate(), // 31 January
        };
    }
    return {
        start: Formatter.luxon().set({ year: academicStartYear + 1, month: 2, day: 1 }).startOf('day').toJSDate(), // 1 February
        end: Formatter.luxon().set({ year: academicStartYear + 1, month: 5, day: 1 }).endOf('month').toJSDate(), // 31 May
    };
}

function datesForType(type: ConfigType): { start: Date; end: Date } {
    if (type === 'year') {
        return yearDates(startMonth.value);
    }
    if (type === 'semester') {
        return semesterDates(semester.value);
    }
    return { start: customStartDate.value, end: customEndDate.value };
}

// When switching to custom, seed the custom dates with the values from the previous option.
watch(configType, (newType, oldType) => {
    if (newType === 'custom' && oldType !== 'custom') {
        const { start, end } = datesForType(oldType);
        customStartDate.value = start;
        customEndDate.value = end;
    }
});

const effectiveStart = computed(() => datesForType(configType.value).start);
const effectiveEnd = computed(() => datesForType(configType.value).end);

/**
 * The name we store, based on the chosen configuration:
 * - year: the default work year name ("Werkjaar JJJJ - JJJJ")
 * - semester: "Semester {number} - {year}"
 * - custom: guessed from the length of the period
 */
const customName = computed<string | null>(() => {
    if (configType.value === 'year') {
        return null;
    }
    if (configType.value === 'semester') {
        return $t('Semester {number} - {year}', { number: semester.value.toString(), year: Formatter.luxon(effectiveStart.value).year.toString() });
    }
    return guessCustomName(effectiveStart.value, effectiveEnd.value);
});

/**
 * For a custom period, guess a name based on its length (semester ≈ 6 months,
 * trimester ≈ 4 months, quarter ≈ 3 months). Returns null for a regular work year.
 */
function guessCustomName(start: Date, end: Date): string | null {
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const luxonStart = Formatter.luxon(start);
    const month0 = luxonStart.month - 1; // 0-based month
    const year = luxonStart.year.toString();

    if (months > 7) {
        return null;
    }
    if (months >= 5) {
        return $t('Semester {number} - {year}', { number: (Math.floor(month0 / 6) + 1).toString(), year });
    }
    if (months >= 3.5) {
        return $t('Trimester {number} - {year}', { number: (Math.floor(month0 / 4) + 1).toString(), year });
    }
    return $t('Kwartaal {number} - {year}', { number: (Math.floor(month0 / 3) + 1).toString(), year });
}

const previewName = computed(() => RegistrationPeriod.create({ startDate: effectiveStart.value, endDate: effectiveEnd.value, customName: customName.value }).name);

async function goNext() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

    try {
        if (effectiveEnd.value.getTime() < effectiveStart.value.getTime()) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'endDate',
                message: $t('De einddatum moet na de startdatum liggen.'),
            });
        }

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<RegistrationPeriod>;
        arr.addPatch(RegistrationPeriod.patch({
            id: period.id,
            customName: customName.value,
            startDate: effectiveStart.value,
            endDate: effectiveEnd.value,
        }));

        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/registration-periods',
            body: arr,
            decoder: new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>),
            owner,
            shouldRetry: false,
        });
        clearOrganizationPeriodsCache();

        // Keep the in-memory organization in sync so the user resumes with the saved values.
        const updated = response.data.find(p => p.id === period.id);
        if (updated) {
            period.deepSet(updated);
        }

        await props.saveHandler(navigationActions);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        saving.value = false;
    }
}
</script>

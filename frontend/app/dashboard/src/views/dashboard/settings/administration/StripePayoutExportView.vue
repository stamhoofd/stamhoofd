<template>
    <SaveView :loading="saving" :title="$t('%Zbt')" :save-text="$t('%Oy')" @save="save">
        <h1>
            {{ $t('%Zby') }}
        </h1>
        <p>{{ $t('%Zbu') }}</p>

        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errorBox" :title="$t('%5M')">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errorBox" :title="$t('%3w')">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </div>

        <p class="style-description-small">
            {{ $t('%P0') }}: <span v-for="(suggestion, index) in dateRangeSuggestions" :key="suggestion.name">
                <button type="button" class="inline-link" :class="isSuggestionSelected(suggestion) ? {secundary: false} : {secundary: true}" @click="selectSuggestion(suggestion)">
                    {{ suggestion.name }}
                </button><template v-if="index < dateRangeSuggestions.length - 1">, </template>
            </span>
        </p>

        <hr><h2>{{ $t('%P1') }}</h2>
        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useUTCTimezone" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%P2') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%P3') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="runningJobs.length" class="container">
            <hr><h2>{{ $t('%Zc2') }}</h2>
            <STList>
                <STListItem v-for="(runningJob, index) in runningJobs" :key="index">
                    <h3 class="style-title-list">
                        {{ $t('%Zbz', {start: formatDateTime(runningJob.start), end: formatDateTime(runningJob.end)}) }}
                    </h3>
                    <p v-if="runningJob.count" class="style-description-small">
                        {{ $t('%Zbs', {count: runningJob.count.toString()}) }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

class PayoutExportStatus extends AutoEncoder {
    @field({ decoder: DateDecoder })
    start: Date;

    @field({ decoder: DateDecoder })
    end: Date;

    @field({ decoder: IntegerDecoder })
    count = 0;
}

class DateRangeSuggestion {
    name: string;
    startDate: Date;
    endDate: Date;

    constructor({ name, startDate, endDate }: { name: string; startDate: Date; endDate: Date }) {
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
    }
}

const context = useContext();
const pop = usePop();
const requestOwner = {};
const errorBox = ref<ErrorBox | null>(null);
const saving = ref(false);
const internalStartDate = ref(new Date());
const internalEndDate = ref(new Date());
const useUTCTimezone = ref(true);
const dateRangeSuggestions = shallowRef<DateRangeSuggestion[]>([]);
const runningJobs = shallowRef<PayoutExportStatus[]>([]);
let loadingJobs = false;
let interval: ReturnType<typeof setInterval> | null = null;

const startDate = computed({
    get: () => internalStartDate.value,
    set: (value: Date) => {
        internalStartDate.value = new Date(value.getTime());
        internalStartDate.value.setHours(0, 0, 0, 0);
    },
});
const endDate = computed({
    get: () => internalEndDate.value,
    set: (value: Date) => {
        internalEndDate.value = new Date(value.getTime());
        internalEndDate.value.setHours(23, 59, 59, 0);
    },
});
const correctedStartDate = computed(() => {
    if (!useUTCTimezone.value) {
        return startDate.value;
    }
    const date = new Date();
    date.setUTCFullYear(startDate.value.getFullYear(), startDate.value.getMonth(), startDate.value.getDate());
    date.setUTCHours(0, 0, 0, 0);
    return date;
});
const correctedEndDate = computed(() => {
    if (!useUTCTimezone.value) {
        return endDate.value;
    }
    const date = new Date();
    date.setUTCFullYear(endDate.value.getFullYear(), endDate.value.getMonth(), endDate.value.getDate());
    date.setUTCHours(23, 59, 59, 0);
    return date;
});

onMounted(() => {
    buildSuggestions();
    selectSuggestion(dateRangeSuggestions.value[0]!);

    loadJobs().catch(console.error);
    interval = setInterval(() => {
        loadJobs().catch(console.error);
    }, 1000);
});

onBeforeUnmount(() => {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    Request.cancelAll(requestOwner);
});

function formatDateTime(date: Date) {
    return Formatter.dateTime(date);
}

async function loadJobs() {
    if (loadingJobs) {
        return;
    }
    loadingJobs = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/stripe/payouts/status',
            decoder: new ArrayDecoder(PayoutExportStatus as Decoder<PayoutExportStatus>),
            shouldRetry: false,
            owner: requestOwner,
        });
        runningJobs.value = response.data;
    } catch (e) {
        if (!Request.isAbortError(e)) {
            console.error(e);
        }
    }
    loadingJobs = false;
}

function buildSuggestions() {
    dateRangeSuggestions.value = [
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().startOf('month').toJSDate()),
            startDate: Formatter.luxon().startOf('month').toJSDate(),
            endDate: Formatter.luxon().endOf('month').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().minus({ month: 1 }).startOf('month').toJSDate()),
            startDate: Formatter.luxon().minus({ month: 1 }).startOf('month').toJSDate(),
            endDate: Formatter.luxon().minus({ month: 1 }).endOf('month').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().minus({ month: 2 }).startOf('month').toJSDate()),
            startDate: Formatter.luxon().minus({ month: 2 }).startOf('month').toJSDate(),
            endDate: Formatter.luxon().minus({ month: 2 }).endOf('month').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().minus({ month: 3 }).startOf('month').toJSDate()),
            startDate: Formatter.luxon().minus({ month: 3 }).startOf('month').toJSDate(),
            endDate: Formatter.luxon().minus({ month: 3 }).endOf('month').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.year(Formatter.luxon().startOf('year').toJSDate()).toString(),
            startDate: Formatter.luxon().startOf('year').toJSDate(),
            endDate: Formatter.luxon().endOf('year').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.year(Formatter.luxon().minus({ year: 1 }).startOf('year').toJSDate()).toString(),
            startDate: Formatter.luxon().minus({ year: 1 }).startOf('year').toJSDate(),
            endDate: Formatter.luxon().minus({ year: 1 }).endOf('year').toJSDate(),
        }),
    ];
}

function selectSuggestion(suggestion: DateRangeSuggestion) {
    startDate.value = suggestion.startDate;
    endDate.value = suggestion.endDate;
}

function isSuggestionSelected(suggestion: DateRangeSuggestion) {
    return Formatter.dateIso(startDate.value) === Formatter.dateIso(suggestion.startDate)
        && Formatter.dateIso(endDate.value) === Formatter.dateIso(suggestion.endDate);
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/stripe/payouts',
            body: {
                start: correctedStartDate.value.getTime(),
                end: correctedEndDate.value.getTime(),
            },
            owner: requestOwner,
        });
        new Toast($t('%Zc5'), 'success').show();
        await pop({ force: true });
    } catch (e) {
        errorBox.value = new ErrorBox(e as Error);
    }
    saving.value = false;
}
</script>

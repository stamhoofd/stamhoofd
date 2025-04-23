<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`Logboek`)" />

        <main class="center">
            <h1>
                {{ $t('Logboek') }}
            </h1>
            <p>{{ $t('In het logboek worden alle gebeurtenissen geregistreerd. Enkel hoofdbeheerders hebben toegang tot het logboek.') }}</p>

            <div class="input-with-buttons">
                <div>
                    <div class="split-inputs">
                        <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`Vanaf`)">
                            <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" :required="false" :placeholder="$t(`Begin`)" />
                        </STInputBox>

                        <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`Tot en met`)">
                            <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" :required="false" :placeholder="$t(`Nu`)" />
                        </STInputBox>
                    </div>

                    <p class="style-description-small">
                        {{ $t('Snel selecteren:') }} <span v-for="(suggestion, index) in dateRangeSuggestions" :key="suggestion.name">
                            <button type="button" class="inline-link" :class="isSuggestionSelected(suggestion) ? {secundary: false} : {secundary: true}" @click="selectSuggestion(suggestion)">
                                {{ suggestion.name }}
                            </button><template v-if="index < dateRangeSuggestions.length - 1">, </template>
                        </span>
                    </p>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">{{ $t('Filter') }}</span>
                        <span v-if="!isEmptyFilter(fetcher.baseFilter)" class="icon dot primary" />
                    </button>
                </div>
            </div>

            <hr><div v-for="(group, index) of groupedLogs" :key="group.title" class="container">
                <hr v-if="index > 0"><h2>{{ Formatter.capitalizeFirstLetter(group.title) }}</h2>

                <STList>
                    <AuditLogRow v-for="log of group.logs" :key="log.id" :log="log" />
                </STList>
            </div>

            <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`Geen logs gevonden`)" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { DateSelection, useOrganization, useVisibilityChange } from '@stamhoofd/components';
import { AuditLog, isEmptyFilter, mergeFilters } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onActivated, ref, Ref, watch } from 'vue';
import { useErrors } from '../errors/useErrors';
import { useAuditLogsObjectFetcher } from '../fetchers';
import { useAuditLogUIFilterBuilders } from '../filters/filterBuilders';
import { UIFilter } from '../filters/UIFilter';
import UIFilterEditor from '../filters/UIFilterEditor.vue';
import { InfiniteObjectFetcherEnd, useInfiniteObjectFetcher, usePositionableSheet } from '../tables';
import AuditLogRow from './components/AuditLogRow.vue';

type ObjectType = AuditLog;

const props = withDefaults(
    defineProps<{
        objectIds?: string[] | null;
    }>(), {
        objectIds: null,
    });

const { presentPositionableSheet } = usePositionableSheet();

const filterBuilders = useAuditLogUIFilterBuilders();
const selectedUIFilter = ref(null) as Ref<null | UIFilter>;
const startDate = ref(null) as Ref<Date | null>;
const endDate = ref(null) as Ref<Date | null>;
const errors = useErrors();
const organization = useOrganization();

const objectFetcher = useAuditLogsObjectFetcher({
    requiredFilter: props.objectIds ? { objectId: { $in: props.objectIds } } : { organizationId: organization.value?.id ?? null },
});

const fetcher = useInfiniteObjectFetcher<ObjectType>(objectFetcher);

const groupedLogs = computed(() => {
    return groupLogs(fetcher.objects);
});

useVisibilityChange(() => {
    fetcher.reset();
});

onActivated(() => {
    fetcher.reset();
});

watch(() => {
    let filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    if (startDate.value) {
        filter = mergeFilters([
            filter,
            { createdAt: { $gte: startDate.value } },
        ]);
    }
    if (endDate.value) {
        filter = mergeFilters([
            filter,
            { createdAt: { $lte: endDate.value } },
        ]);
    }
    return filter;
}, (filter) => {
    console.log('Set filter in UI', JSON.stringify(filter, undefined, 2));
    fetcher.setFilter(filter);
}, { immediate: true });

async function editFilter(log: MouseEvent) {
    if (!filterBuilders) {
        return;
    }
    const filter = selectedUIFilter.value ?? filterBuilders[0].create();
    if (!selectedUIFilter.value) {
        selectedUIFilter.value = filter;
    }

    await presentPositionableSheet(log, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter,
                }),
            }),
        ],
    });
}

function groupLogs(logs: AuditLog[]) {
    const queue: {
        title: string;
        logs: AuditLog[];
    }[] = [];

    for (const log of logs) {
        const title = dateRangeSuggestions.find(s => log.createdAt >= s.startDate && log.createdAt <= s.endDate)?.name ?? (Formatter.month(log.createdAt) + ' ' + Formatter.year(log.createdAt));

        const group = queue[queue.length - 1];
        if (group && group.title === title) {
            group.logs.push(log);
        }
        else {
            queue.push({ title, logs: [log] });
        }
    }
    return queue;
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

const dateRangeSuggestions = buildSuggestions();

function buildSuggestions() {
    const r = [
        new DateRangeSuggestion({
            name: 'vandaag',
            startDate: Formatter.luxon().startOf('day').toJSDate(),
            endDate: Formatter.luxon().endOf('day').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: 'gisteren',
            startDate: Formatter.luxon().minus({ day: 1 }).startOf('day').toJSDate(),
            endDate: Formatter.luxon().minus({ day: 1 }).endOf('day').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: 'deze week',
            startDate: Formatter.luxon().startOf('week').toJSDate(),
            endDate: Formatter.luxon().endOf('week').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: 'vorige week',
            startDate: Formatter.luxon().minus({ day: 7 }).startOf('week').toJSDate(),
            endDate: Formatter.luxon().minus({ day: 7 }).endOf('week').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().startOf('month').toJSDate()),
            startDate: Formatter.luxon().startOf('month').toJSDate(),
            endDate: Formatter.luxon().endOf('month').toJSDate(),
        }),
    ];

    // Start / end times
    // this fixes the auto correct of the date selection inputs
    for (const rr of r) {
        rr.startDate.setHours(0, 0, 0, 0);
        rr.endDate.setHours(23, 59, 59, 0);
    }

    return r;
}

function selectSuggestion(suggestion: DateRangeSuggestion) {
    startDate.value = suggestion.startDate;
    endDate.value = suggestion.endDate;
}

function isSuggestionSelected(suggestion: DateRangeSuggestion) {
    if (!startDate.value || !endDate.value) {
        return false;
    }
    return Formatter.dateIso(startDate.value) === Formatter.dateIso(suggestion.startDate) && Formatter.dateIso(endDate.value) === Formatter.dateIso(suggestion.endDate);
}

</script>

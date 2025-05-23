<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`c2cbfcc6-dfdd-4047-b178-76211382d405`)" />

        <main class="center">
            <h1>
                {{ $t('1b5413cd-5858-4a73-872b-5b6b26345039') }}
            </h1>
            <p>{{ $t('13f40024-23b0-4ce0-b472-8cbb86e30668') }}</p>

            <div class="input-with-buttons">
                <div>
                    <div class="split-inputs">
                        <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`22761311-3065-49fd-82ca-bc60aae3c975`)">
                            <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" :required="false" :placeholder="$t(`2aa1f986-93d6-410c-9746-70c02fb4f5ea`)" />
                        </STInputBox>

                        <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`feaf0054-1b99-4526-821e-3c63e64574a0`)">
                            <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" :required="false" :placeholder="$t(`92be5ac5-79f3-4f2c-9525-7c11f173931a`)" />
                        </STInputBox>
                    </div>

                    <p class="style-description-small">
                        {{ $t('e0581b7e-aaa2-4e8e-85fc-6a1b9ed4900a') }} <span v-for="(suggestion, index) in dateRangeSuggestions" :key="suggestion.name">
                            <button type="button" class="inline-link" :class="isSuggestionSelected(suggestion) ? {secundary: false} : {secundary: true}" @click="selectSuggestion(suggestion)">
                                {{ suggestion.name }}
                            </button><template v-if="index < dateRangeSuggestions.length - 1">, </template>
                        </span>
                    </p>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">{{ $t('de5706ec-7edc-4e62-b3f7-d6e414720480') }}</span>
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

            <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`f1972be3-b3c8-42ff-916b-a6ad51dd9f2e`)" />
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
            name: $t(`13f1507b-7ad1-4748-981f-8b7b12aa2dce`),
            startDate: Formatter.luxon().startOf('day').toJSDate(),
            endDate: Formatter.luxon().endOf('day').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: $t(`12a16bab-7d3e-46e0-95dc-43aef6818bff`),
            startDate: Formatter.luxon().minus({ day: 1 }).startOf('day').toJSDate(),
            endDate: Formatter.luxon().minus({ day: 1 }).endOf('day').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: $t(`1089afa3-5103-44de-a7e5-9501f058b26e`),
            startDate: Formatter.luxon().startOf('week').toJSDate(),
            endDate: Formatter.luxon().endOf('week').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: $t(`c37c5108-b223-4a83-8a05-e51324da93b7`),
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

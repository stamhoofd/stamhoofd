<template>
    <div class="st-view background">
        <STNavigationBar :title="$t(`%1DK`)" />

        <main class="center">
            <h1>
                {{ $t('%1DK') }}
            </h1>

            <div class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">{{ $t('%2J') }}</span>
                        <span v-if="!isEmptyFilter(fetcher.baseFilter)" class="icon dot primary" />
                    </button>
                </div>
            </div>
            <hr>

            <div v-for="(group, index) of groupedEmails" :key="group.title" class="container">
                <hr v-if="index > 0"><h2>{{ Formatter.capitalizeFirstLetter(group.title) }}</h2>

                <STList>
                    <EmailRow v-for="email of group.emails" :key="email.id" :email="email" @click="onClickEmail(email)" />
                </STList>
            </div>

            <p v-if="errorMessage" class="error-box with-button">
                {{ errorMessage }}

                <button class="button text" type="button" @click="refresh">
                    {{ $t('%Y9') }}
                </button>
            </p>
            <InfiniteObjectFetcherEnd v-else :fetcher="fetcher" :empty-message="$t(`%1ET`)" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate } from '@simonbackx/vue-app-navigation';
import { useUserEmailsObjectFetcher } from '@stamhoofd/components/fetchers/useUserEmailsObjectFetcher.ts';
import { useEmailFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import type { UIFilter } from '@stamhoofd/components/filters/UIFilter.ts';
import UIFilterEditor from '@stamhoofd/components/filters/UIFilterEditor.vue';
import { useVisibilityChange } from '@stamhoofd/components/hooks/useVisibilityChange.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useInfiniteObjectFetcher } from '@stamhoofd/components/tables/classes/InfiniteObjectFetcher.ts';
import InfiniteObjectFetcherEnd from '@stamhoofd/components/tables/InfiniteObjectFetcherEnd.vue';
import { usePositionableSheet } from '@stamhoofd/components/tables/usePositionableSheet.ts';
import type { EmailWithRecipients, StamhoofdFilter } from '@stamhoofd/structures';
import { isEmptyFilter, LimitedFilteredRequest, SortItemDirection } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref, watchEffect } from 'vue';
import EmailRow from './components/EmailRow.vue';
import MemberEmailOverview from './MemberEmailOverview.vue';

type ObjectType = EmailWithRecipients;

const searchQuery = ref('');
const $navigate = useNavigate();
const { presentPositionableSheet } = usePositionableSheet();

const buildFilters = useEmailFilterBuilders();
const filterBuilders = buildFilters();
const selectedUIFilter = ref(createDefaultUIFilter()) as Ref<null | UIFilter>;

enum Routes {
    Email = 'bericht',
}

defineRoutes([
    {
        name: Routes.Email,
        url: '@id',
        component: MemberEmailOverview,
        present: 'popup',
        params: {
            id: String,
        },
        paramsToProps: async (params: { id: string }) => {
            // Fetch event
            const events = await fetcher.objectFetcher.fetch(
                new LimitedFilteredRequest({
                    filter: {
                        id: params.id,
                    },
                    limit: 1,
                    sort: [],
                }),
            );

            if (events.results.length === 1) {
                return {
                    email: events.results[0],
                };
            }
            Toast.error($t(`%1D0`)).show();
            throw new Error('Email not found');
        },

        propsToParams(props) {
            if (!('email' in props) || typeof props.email !== 'object' || props.email === null || !('id' in props.email)) {
                throw new Error('Missing email');
            }
            return {
                params: {
                    id: props.email.id,
                },
            };
        },
    },
]);

const objectFetcher = useUserEmailsObjectFetcher({
    get requiredFilter() {
        return getRequiredFilter();
    },
});

const fetcher = useInfiniteObjectFetcher<ObjectType>(objectFetcher);
fetcher.sort = [{
    key: 'sentAt',
    order: SortItemDirection.DESC,
}];

const errorMessage = computed(() => {
    if (fetcher.errorState) {
        const errors = fetcher.errorState;

        let simpleErrors!: SimpleErrors;
        if (isSimpleError(errors)) {
            simpleErrors = new SimpleErrors(errors);
        }
        else if (isSimpleErrors(errors)) {
            simpleErrors = errors;
        }
        else {
            simpleErrors = new SimpleErrors(new SimpleError({
                code: 'unknown_error',
                message: errors.message,
            }));
        }

        return simpleErrors.getHuman();
    }

    return null;
});

useVisibilityChange(() => {
    if (fetcher.objects.length > fetcher.limit) {
        // Do not update when coming back because we would loose scroll position
        return;
    }
    fetcher.reset();
});

function refresh() {
    fetcher.reset();
}

const groupedEmails = computed(() => {
    return groupData(fetcher.objects);
});

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value);
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter);
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

async function onClickEmail(email: ObjectType) {
    await $navigate(Routes.Email, { properties: { email } });
}

async function editFilter(event: MouseEvent) {
    if (!filterBuilders) {
        return;
    }
    const filter = selectedUIFilter.value ?? filterBuilders[0].create();
    if (!selectedUIFilter.value) {
        selectedUIFilter.value = filter;
    }

    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter,
                }),
            }),
        ],
    });
}

function getRequiredFilter(): StamhoofdFilter | null {
    return null;
}

function getDefaultStamhoofdFilter(): StamhoofdFilter {
    return null;
}

function createDefaultUIFilter(): UIFilter | null {
    const filter = getDefaultStamhoofdFilter();
    return filterBuilders[0].fromFilter(filter);
}

function groupData(emails: ObjectType[]) {
    const queue: {
        title: string;
        emails: ObjectType[];
    }[] = [];

    for (const email of emails) {
        const title = dateRangeSuggestions.find(s => email.createdAt >= s.startDate && email.createdAt <= s.endDate)?.name ?? (Formatter.month(email.createdAt) + ' ' + Formatter.year(email.createdAt));

        const group = queue[queue.length - 1];
        if (group && group.title === title) {
            group.emails.push(email);
        }
        else {
            queue.push({ title, emails: [email] });
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
            name: $t(`%uT`),
            startDate: Formatter.luxon().startOf('day').toJSDate(),
            endDate: Formatter.luxon().endOf('day').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: $t(`%uU`),
            startDate: Formatter.luxon().minus({ day: 1 }).startOf('day').toJSDate(),
            endDate: Formatter.luxon().minus({ day: 1 }).endOf('day').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: $t(`%uV`),
            startDate: Formatter.luxon().startOf('week').toJSDate(),
            endDate: Formatter.luxon().endOf('week').toJSDate(),
        }),

        new DateRangeSuggestion({
            name: $t(`%uW`),
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

</script>

<template>
    <div class="st-view background">
        <STNavigationBar :title="$t(`7dfd0425-b8ff-4dec-8c6d-257d94eabbe7`)" />

        <main class="center">
            <h1>
                {{ $t('a6304a41-8c83-419b-8e7e-c26f4a047c19') }}
            </h1>
            <p v-if="props.members && props.members.length > 0">
                {{ $t('7bd45367-4d32-408d-80f8-83bcc120d1de', { firstName: props.members.map(m => m.patchedMember.firstName).join(', ') }) }}
            </p>
            <p v-else>
                {{ $t(`feae4831-c229-4b2a-8dc1-c65184cbdfec`) }}
            </p>

            <div class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`01e2b860-7045-4a0c-84ca-2303346d14b2`)">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">{{ $t('de5706ec-7edc-4e62-b3f7-d6e414720480') }}</span>
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
                    {{ $t('7889a8f8-a31e-4291-b8e7-6169e68ed6b4') }}
                </button>
            </p>
            <InfiniteObjectFetcherEnd v-else :fetcher="fetcher" :empty-message="$t(`8fec0620-6293-4573-884d-07d7ab814a77`)" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate } from '@simonbackx/vue-app-navigation';
import { InfiniteObjectFetcherEnd, Toast, UIFilter, UIFilterEditor, useAdminEmailFilterBuilders, useInfiniteObjectFetcher, useOrganization, usePositionableSheet, useVisibilityChange } from '@stamhoofd/components';
import { useEmailsObjectFetcher } from '#fetchers/useEmailsObjectFetcher.ts';
import { EmailPreview, isEmptyFilter, LimitedFilteredRequest, PlatformMember, SortItemDirection, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, ref, Ref, watchEffect } from 'vue';
import EmailRow from './components/EmailRow.vue';
import EmailOverview from './EmailOverview.vue';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

type ObjectType = EmailPreview;

const props = withDefaults(defineProps<{
    members?: (PlatformMember[]) | null;
}>(), {
    members: null,
});

const searchQuery = ref('');
const $navigate = useNavigate();
const { presentPositionableSheet } = usePositionableSheet();

const buildFilters = useAdminEmailFilterBuilders();
const filterBuilders = buildFilters();
const organization = useOrganization();
const selectedUIFilter = ref(createDefaultUIFilter()) as Ref<null | UIFilter>;

enum Routes {
    Email = 'bericht',
}

defineRoutes([
    {
        name: Routes.Email,
        url: '@id',
        component: EmailOverview as ComponentOptions,
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
            Toast.error($t(`6e1f9492-f036-4b73-8e85-ccbae0d31ad7`)).show();
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

const objectFetcher = useEmailsObjectFetcher({
    get requiredFilter() {
        return getRequiredFilter();
    },
});

const fetcher = useInfiniteObjectFetcher<ObjectType>(objectFetcher);
fetcher.sort = [{
    key: 'createdAt',
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

async function onClickEmail(email: EmailPreview) {
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
    if (props.members && props.members.length > 0) {
        return {
            recipients: {
                $elemMatch: {
                    memberId: {
                        $in: props.members.map(m => m.id),
                    },
                },
            },
        };
    }
    return null;
}

function getDefaultStamhoofdFilter(): StamhoofdFilter {
    if (!organization.value) {
        return {
            organizationId: null,
        };
    }
    return null;
}

function createDefaultUIFilter(): UIFilter | null {
    if (props.members && props.members.length > 0) {
        return null;
    }
    const filter = getDefaultStamhoofdFilter();
    return filterBuilders[0].fromFilter(filter);
}

function groupData(emails: EmailPreview[]) {
    const queue: {
        title: string;
        emails: EmailPreview[];
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

</script>

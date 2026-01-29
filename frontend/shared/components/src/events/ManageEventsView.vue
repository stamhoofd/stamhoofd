<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`60231186-b00f-4d07-a5c7-4a905467e254`)">
            <template #right>
                <button v-if="canWriteSomeEvent" type="button" class="button text navigation" @click="addEvent()">
                    <span class="icon add" />
                    <span>{{ $t('e69989bf-c310-49b4-aff1-b9c84cfe5760') }}</span>
                </button>
            </template>
        </STNavigationBar>

        <main class="center">
            <h1>
                {{ $t('d9b4472a-a395-4877-82fd-da6cb0140594') }}
            </h1>

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

            <ScrollableSegmentedControl v-model="selectedYear" :items="years" :labels="yearLabels" />

            <template v-if="selectedYear === null && suggestionsGroup">
                <Checkbox v-model="addSuggestions">
                    {{ $t('66812919-eadf-4906-96a5-35677c4b6ccb') }} {{ suggestionsGroup.settings.name }}
                </Checkbox>

                <hr>
            </template>

            <div v-for="(group, index) of groupedEvents" :key="group.title" class="container">
                <hr v-if="index > 0"><h2>{{ Formatter.capitalizeFirstLetter(group.title) }}</h2>

                <STList>
                    <EventRow v-for="event of group.events" :key="event.id" :event="event" @click="onClickEvent(event)" />
                </STList>
            </div>

            <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`2a4caf43-3e88-45b6-b337-4c7036130769`)" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { Event, isEmptyFilter, LimitedFilteredRequest, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, ref, Ref, watch, watchEffect } from 'vue';
import { useAppContext } from '../context';
import { useEventsObjectFetcher } from '../fetchers';
import { useEventUIFilterBuilders } from '../filters/filterBuilders';
import { UIFilter } from '../filters/UIFilter';
import UIFilterEditor from '../filters/UIFilterEditor.vue';
import { useAuth, useGlobalEventListener, useOrganization, usePlatform, useUser } from '../hooks';
import ScrollableSegmentedControl from '../inputs/ScrollableSegmentedControl.vue';
import { Toast } from '../overlays/Toast';
import { InfiniteObjectFetcherEnd, useInfiniteObjectFetcher, usePositionableSheet } from '../tables';
import EventRow from './components/EventRow.vue';
import { useEventPermissions } from './composables/useEventPermissions';
import EditEventView from './EditEventView.vue';
import EventOverview from './EventOverview.vue';

type ObjectType = Event;

const searchQuery = ref('');
const present = usePresent();

const selectedYear = ref(null) as Ref<number | null>;
const years = computed(() => {
    const currentYear = Formatter.year(new Date());
    return [null, currentYear, currentYear - 1, currentYear - 2];
});
const user = useUser();
const organization = useOrganization();
const platform = usePlatform();
const $navigate = useNavigate();
const { presentPositionableSheet } = usePositionableSheet();
const auth = useAuth();
const eventPermissions = useEventPermissions();

const filterBuilders = useEventUIFilterBuilders({ platform: platform.value, organizations: organization.value ? [organization.value] : [], app: useAppContext() });
const selectedUIFilter = ref(createDefaultUIFilter()) as Ref<null | UIFilter>;

const yearLabels = computed(() => {
    return years.value.map((y) => {
        if (y === null) {
            return $t(`4cb84435-bf36-4b83-9f0d-6028181eae84`);
        }
        return y.toString();
    });
});

const canWriteSomeEvent = computed(() => eventPermissions.canWriteSome());

enum Routes {
    Event = 'activiteit',
}

defineRoutes([
    {
        name: Routes.Event,
        url: '@id',
        component: EventOverview as ComponentOptions,
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
                    event: events.results[0],
                    onSaveDuplicate: onSaveDuplicateEvent,
                };
            }
            Toast.error($t(`42e0e0d5-b4f9-4774-ad91-bfae7121a29e`)).show();
            throw new Error('Event not found');
        },

        propsToParams(props) {
            if (!('event' in props) || typeof props.event !== 'object' || props.event === null || !('id' in props.event)) {
                throw new Error('Missing event');
            }
            return {
                params: {
                    id: props.event.id,
                },
            };
        },
    },
]);

const objectFetcher = useEventsObjectFetcher({
    get requiredFilter() {
        return getRequiredFilter();
    },
});

const fetcher = useInfiniteObjectFetcher<ObjectType>(objectFetcher);

const addSuggestions = ref(false);
const suggestedGroups = computed(() => {
    const u = user.value;
    if (!u || !u.memberId) {
        return [];
    }
    const member = u.members.members.find(m => m.id === u.memberId);
    if (!member) {
        return [];
    }

    const responsibilities = member.responsibilities.filter(r => r.isActive && !!r.groupId);
    const groups = [organization.value, ...u.members.organizations].flatMap(o => o?.period.groups ?? []);
    return groups.filter(g => g.settings.defaultEventTime && responsibilities.some(r => r.groupId === g.id));
});
const suggestionsGroup = ref(suggestedGroups.value[0]) ?? null;

const fillEventsUntil = computed(() => {
    const fetcherLastDate = fetcher.objects[fetcher.objects.length - 1]?.startDate;

    if (fetcher.hasMoreObjects) {
        return fetcherLastDate ?? new Date();
    }

    const fillUntil = Formatter.luxon(new Date()).plus({ months: 2 }).endOf('month').toJSDate();

    return new Date(Math.max(fillUntil.getTime(), fetcherLastDate?.getTime() ?? 0));
});

const dayOfWeekSuggestion = 7; // Sunday

const eventSuggestions = computed(() => {
    if (!addSuggestions.value || selectedYear.value !== null) {
        return [];
    }

    let pointer = Formatter.luxon(new Date());
    const end = Formatter.luxon(fillEventsUntil.value);
    const suggestions: Event[] = [];

    // Find next sunday (dayOfWeekSuggestion)

    while (pointer < end) {
        pointer = pointer.plus({ days: 1 });

        if (pointer.weekday === dayOfWeekSuggestion) {
            // Found next sunday
            suggestions.push(
                Event.create({
                    id: '',
                    name: $t(`2506b55d-cd6e-42e5-a69d-f0d838bfaad2`),
                    startDate: pointer.toJSDate(),
                    endDate: pointer.toJSDate(),
                }),
            );
        }
    }

    return suggestions;
});

const filledEvents = computed(() => {
    const added = eventSuggestions.value.filter((e) => {
        for (const event of fetcher.objects) {
            if (Formatter.dateIso(event.startDate) === Formatter.dateIso(e.startDate)) {
                return false;
            }
        }
        return true;
    });

    return [...fetcher.objects, ...added].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
});

const groupedEvents = computed(() => {
    return Event.group(filledEvents.value);
});

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value);
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter);
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

async function addEvent(template?: Event) {
    if (platform.value.config.eventTypes.length === 0) {
        if (auth.hasFullPlatformAccess()) {
            Toast.error($t('Configureer eerst minstens één soort activiteit. Ga naar \'Instellingen\' → \'Soorten activiteiten\' in het Administratieportaal.')).show();
        }
        else {
            Toast.error($t(`28b7fa87-b4b9-45de-aa95-1d7fea6aee73`)).show();
        }
        return;
    }

    const event = (template?.clone() ?? Event.create({}));
    event.id = Event.create({}).id;
    event.organizationId = organization.value?.id ?? null;

    const defaultStartDate = Formatter.luxon().plus({ days: 1 }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
    const defaultEndDate = Formatter.luxon().plus({ days: 1 }).set({ hour: 14, minute: 0, second: 0, millisecond: 0 });

    event.startDate = defaultStartDate.toJSDate();
    event.endDate = defaultEndDate.toJSDate();

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventView, {
                event,
                isNew: true,
                callback: () => {
                    fetcher.reset();
                    onClickEvent(event).catch(console.error);
                },
            }),
        ],
    });
}

async function onClickEvent(event: Event) {
    if (!event.id) {
        // Create a new one
        return await addEvent(event);
    }

    await $navigate(Routes.Event, { properties: { event, onSaveDuplicate: onSaveDuplicateEvent } });
}

async function editFilter(event: MouseEvent) {
    if (!filterBuilders) {
        return;
    }
    const filter = selectedUIFilter.value ?? filterBuilders.value[0].create();
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

async function onSaveDuplicateEvent(event: Event) {
    fetcher.reset();
    await onClickEvent(event);
}

function getRequiredFilter(): StamhoofdFilter | null {
    const org = organization.value;

    const filters: StamhoofdFilter = {};

    // filter on start date
    if (selectedYear.value === null) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);

        filters['startDate'] = {
            $gt: d,
        };
    }
    else {
        filters['$and'] = [
            {
                startDate: {
                    $gte: new Date(selectedYear.value, 0, 1),
                },
            },
            {
                startDate: {
                    $lt: new Date(selectedYear.value + 1, 0, 1),
                },
            },
        ];
    }

    // filter on organization tag ids, if organization lvl
    if (org) {
        filters['$or'] = [
            {
                organizationTagIds: {
                    $in: [null, ...org.meta.tags],
                },
            }, {
                group: {
                    organizationId: org.id,
                },
            },
        ];
    }

    return filters;
}

function getDefaultStamhoofdFilter(): StamhoofdFilter {
    let groupIds: (string | null)[] | undefined = undefined;
    let organizationTagIds: (string | null)[] | undefined = undefined;
    const isOrganizationScope = organization.value !== null;

    // // only show events for groups where user can edit event for if organization scope
    if (isOrganizationScope) {
        const groupsToFilterEventsOn = eventPermissions.groupsToFilterEventsOn();
        if (groupsToFilterEventsOn) {
            groupIds = [null, ...groupsToFilterEventsOn];
        }
    }
    // only show events for organizations with tag where user can edit event for if platform scope
    else {
        const tagsToFilterEventsOn = eventPermissions.tagsToFilterEventsOn();
        if (tagsToFilterEventsOn) {
            organizationTagIds = tagsToFilterEventsOn;
        }
    }

    if (groupIds === undefined && organizationTagIds === undefined) {
        return null;
    }

    const filter: StamhoofdFilter = {};

    if (groupIds) {
        filter.groupIds = {
            $in: groupIds,
        };
    }

    if (organizationTagIds) {
        filter.organizationTagIds = {
            $in: organizationTagIds,
        };
    }

    return filter;
}

function createDefaultUIFilter(): UIFilter | null {
    const filter = getDefaultStamhoofdFilter();
    return filterBuilders.value[0].fromFilter(filter);
}

useGlobalEventListener('event-deleted', async () => {
    fetcher.reset();
});

watch(selectedYear, () => {
    fetcher.reset();
});

</script>

<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Activiteiten">
            <template #right>
                <button type="button" class="button icon add navigation" @click="addEvent()" />
            </template>
        </STNavigationBar>

        <main class="center">
            <h1>
                Activiteiten
            </h1>


            <div class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">Filter</span>
                        <span v-if="!isEmptyFilter(fetcher.baseFilter)" class="icon dot primary" />
                    </button>
                </div>
            </div>

            <ScrollableSegmentedControl v-model="selectedYear" :items="years" :labels="yearLabels" />
            
            <template v-if="selectedYear === null && suggestionsGroup">
                <Checkbox v-model="addSuggestions">
                    Toon wekelijkse suggesties voor {{ suggestionsGroup.settings.name }}
                </Checkbox>

                <hr>
            </template>

            <div v-for="(group, index) of groupedEvents" :key="group.title" class="container">
                <hr v-if="index > 0">
                <h2>{{ Formatter.capitalizeFirstLetter(group.title) }}</h2>

                <STList>
                    <EventRow v-for="event of group.events" :key="event.id" :event="event" @click="onClickEvent(event)" />
                </STList>
            </div>

            <InfiniteObjectFetcherEnd empty-message="Geen activiteiten gevonden" :fetcher="fetcher" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { assertSort, Event, isEmptyFilter, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, ref, Ref, watch, watchEffect } from 'vue';
import { getEventUIFilterBuilders } from '../filters/filterBuilders';
import { UIFilter } from '../filters/UIFilter';
import UIFilterEditor from '../filters/UIFilterEditor.vue';
import { useContext, useOrganization, usePlatform, useUser } from '../hooks';
import ScrollableSegmentedControl from '../inputs/ScrollableSegmentedControl.vue';
import { Toast } from '../overlays/Toast';
import { InfiniteObjectFetcherEnd, useInfiniteObjectFetcher, usePositionableSheet } from '../tables';
import EventRow from './components/EventRow.vue';
import EditEventView from './EditEventView.vue';
import EventOverview from './EventOverview.vue';

type ObjectType = Event;

const searchQuery = ref('');
const present = usePresent()
const context = useContext();
const selectedUIFilter = ref(null) as Ref<null|UIFilter>;
const selectedYear = ref(null) as Ref<number|null>;
const years = computed(() => {
    const currentYear = Formatter.year(new Date());
    return [null, currentYear, currentYear - 1, currentYear - 2]
})
const user = useUser();
const organization = useOrganization();
const platform = usePlatform()
const $navigate = useNavigate();
const {presentPositionableSheet} = usePositionableSheet()

const filterBuilders = getEventUIFilterBuilders(platform.value, organization.value ? [organization.value] : [])

const yearLabels = computed(() => {
    return years.value.map(y => {
        if (y === null) {
            return 'Toekomstige'
        }
        return y.toString()
    })
})

enum Routes {
    Event = "activiteit"
}

defineRoutes([
    {
        name: Routes.Event,
        url: "@id",
        component: EventOverview as ComponentOptions,
        params: {
            id: String
        },
        paramsToProps: async (params: {id: string}) => {
            // Fetch event
            const events = await fetcher.objectFetcher.fetch(
                new LimitedFilteredRequest({
                    filter: {
                        id: params.id
                    },
                    limit: 1,
                    sort: []
                })
            )

            if (events.results.length === 1) {
                return {
                    event: events.results[0]
                }
            }
            Toast.error('Activiteit niet gevonden').show()
            throw new Error('Event not found')
        },

        propsToParams(props) {
            if (!("event" in props) || typeof props.event !== 'object' || props.event === null || !("id" in props.event)) {
                throw new Error('Missing event')
            }
            return {
                params: {
                    id: props.event.id
                }
            }
        }
    },
])

const fetcher = useInfiniteObjectFetcher<ObjectType>({
    get requiredFilter() {
        return getRequiredFilter()
    },
    async fetch(data: LimitedFilteredRequest): Promise<{results: ObjectType[], next?: LimitedFilteredRequest}> {
        console.log('Events.fetch', data);
        data.sort = extendSort(data.sort);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/events",
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(Event as Decoder<Event>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        });

        console.log('[Done] Events.fetch', data, response.data);        
        return response.data
    },

    async fetchCount(): Promise<number> {
        throw new Error("Method not implemented.");
    }
})

const addSuggestions = ref(false);
const suggestedGroups = computed(() => {
    const u = user.value
    if (!u || !u.memberId) {
        return []
    }
    const member = u.members.members.find(m => m. id === u.memberId)
    if (!member) {
        return []
    }

    const responsibilities = member.responsibilities.filter(r => r.isActive && !!r.groupId)
    const groups = [organization.value, ...u.members.organizations].flatMap(o => o?.period.groups ?? [])
    return groups.filter(g => g.settings.defaultEventTime && responsibilities.some(r => r.groupId === g.id))
})
const suggestionsGroup = ref(suggestedGroups.value[0]) ?? null;

const fillEventsUntil = computed(() => {
    const fetcherLastDate = fetcher.objects[fetcher.objects.length - 1]?.startDate

    if (fetcher.hasMoreObjects) {
        return fetcherLastDate ?? new Date()
    }

    const fillUntil = Formatter.luxon(new Date()).plus({months: 2}).endOf('month').toJSDate()

    return new Date(Math.max(fillUntil.getTime(), fetcherLastDate?.getTime() ?? 0))
})

const dayOfWeekSuggestion = 7 // Sunday

const eventSuggestions = computed(() => {
    if (!addSuggestions.value || selectedYear.value !== null) {
        return []
    }

    let pointer = Formatter.luxon(new Date());
    const end = Formatter.luxon(fillEventsUntil.value);
    const suggestions: Event[] = [];

    // Find next sunday (dayOfWeekSuggestion)
    // eslint-disable-next-line no-constant-condition
    while (pointer < end) {
        pointer = pointer.plus({days: 1});

        if (pointer.weekday === dayOfWeekSuggestion) {
            // Found next sunday
            suggestions.push(
                Event.create({
                    id: '',
                    name: 'Suggestie',
                    startDate: pointer.toJSDate(),
                    endDate: pointer.toJSDate(),
                })
            );
        }
    }

    return suggestions
});

const filledEvents = computed(() => {
    const added = eventSuggestions.value.filter(e => {
        for (const event of fetcher.objects) {
            if (Formatter.dateIso(event.startDate) === Formatter.dateIso(e.startDate)) {
                return false
            }
        }
        return true
    })

    return [...fetcher.objects, ...added].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
});

const groupedEvents = computed(() => {
    return Event.group(filledEvents.value)
});

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value)
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter)
})

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur()
}

async function addEvent(template?: Event) {
    const event = (template?.clone() ?? Event.create({}))
    event.id = Event.create({}).id

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventView, {
                event,
                isNew: true,
                callback: () => {
                    fetcher.reset()
                }
            })
        ]
    })
}

async function onClickEvent(event: Event) {
    if (!event.id) {
        // Create a new one
        return await addEvent(event)
    }

    await $navigate(Routes.Event, {properties: {event}})
}

async function editFilter(event: MouseEvent) {
    if (!filterBuilders) {
        return
    }
    const filter = selectedUIFilter.value ?? filterBuilders[0].create()
    if (!selectedUIFilter.value) {
        selectedUIFilter.value = filter;
    }

    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter
                })
            })
        ]
    })
}

function extendSort(list: SortList): SortList  {
    return assertSort(list, [
        {key: "startDate", order: SortItemDirection.ASC},
        {key: "id"}
    ])
}


function getRequiredFilter(): StamhoofdFilter|null  {
    if (selectedYear.value === null) {
        return {
            startDate: {
                $gt: new Date()
            }
        }
    }

    return {
        $and: [
            {
                startDate: {
                    $gte: new Date(selectedYear.value, 0, 1),
                }
            },
            {
                startDate: {
                    $lt: new Date(selectedYear.value + 1, 0, 1)
                }
            }
        ]
    }
}

watch(selectedYear, () => {
    fetcher.reset()
})

</script>

<template>
    <div class="st-view">
        <STNavigationBar title="Activiteiten" />

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
                        <span v-if="filteredCount > 0" class="bubble primary">{{ formatInteger(filteredCount) }}</span>
                    </button>
                </div>
            </div>
            
            <div v-for="group of groupedEvents" :key="group.title" class="container">
                <hr>
                <h2>{{ Formatter.capitalizeFirstLetter(group.title) }}</h2>

                <STList>
                    <EventRow v-for="event of group.events" :key="event.id" :event="event" @click="$navigate(Routes.Event, {properties: {event}})" />
                </STList>
            </div>

            <InfiniteObjectFetcherEnd empty-message="Geen activiteiten gevonden" :fetcher="fetcher" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate } from '@simonbackx/vue-app-navigation';
import { EventRow, getEventUIFilterBuilders, InfiniteObjectFetcherEnd, Toast, UIFilter, UIFilterEditor, useContext, useInfiniteObjectFetcher, useOrganization, usePlatform, usePositionableSheet } from '@stamhoofd/components';
import { assertSort, Event, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref, watchEffect } from 'vue';
import EventView from './EventView.vue';

type ObjectType = Event;

const searchQuery = ref('');
const filteredCount = ref(0);
const context = useContext();
const selectedUIFilter = ref(null) as Ref<null|UIFilter>;
const organization = useOrganization();
const platform = usePlatform()
const $navigate = useNavigate();
const {presentPositionableSheet} = usePositionableSheet()

const filterBuilders = getEventUIFilterBuilders(platform.value, organization.value ? [organization.value] : [])

enum Routes {
    Event = "activiteit"
}

defineRoutes([
    {
        name: Routes.Event,
        url: "@year/@slug/@id",
        component: EventView as ComponentOptions,
        params: {
            year: Number,
            slug: String,
            id: String
        },
        paramsToProps: async (params: {year: number, slug: string, id: string}) => {
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
            if (!("event" in props) || typeof props.event !== 'object' || props.event === null || !(props.event instanceof Event)) {
                throw new Error('Missing event')
            }
            const event = props.event;

            return {
                params: {
                    year: event.startDate.getFullYear(),
                    slug: Formatter.slug(event.name),
                    id: event.id
                }
            }
        }
    }
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

const groupedEvents = computed(() => {
    return Event.group(fetcher.objects)
});

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value)
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter)
})

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur()
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
    return {
        startDate: {
            $gt: new Date()
        }
    }
}

</script>

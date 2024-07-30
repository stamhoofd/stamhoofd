<template>
    <div id="settings-view" class="st-view background">
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
            
            <div v-for="(group, index) of groupedEvents" :key="group.title" class="container">
                <hr>
                <h2>{{ Formatter.capitalizeFirstLetter(group.title) }}</h2>

                <STList>
                    <EventRow v-for="event of group.events" :key="event.id" :event="event" />
                </STList>
            </div>

            <InfiniteObjectFetcherEnd empty-message="Geen activiteiten gevonden" :fetcher="fetcher" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate } from '@simonbackx/vue-app-navigation';
import { EventRow, getEventUIFilterBuilders, InfiniteObjectFetcherEnd, UIFilter, UIFilterEditor, useContext, useInfiniteObjectFetcher, useOrganization, usePlatform, usePositionableSheet } from '@stamhoofd/components';
import { assertSort, Event, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref, watchEffect } from 'vue';

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

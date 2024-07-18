<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Activiteiten">
            <template #right>
                <button type="button" class="button icon add navigation" @click="addEvent" />
            </template>
        </STNavigationBar>

        <main class="center">
            <h1>
                Activiteiten
            </h1>
            <p>Voeg evenementen of activiteiten toe aan je kalender waarvoor leden al dan niet kunnen inschrijven via het ledenportaal.</p>

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

            <STList>
                <STListItem v-for="event of fetcher.objects" :key="event.id" class="" @click="editEvent(event)">
                    <h3 class="style-title-list">
                        {{ event.name }}
                    </h3>
                    <p class="style-description-small">
                        {{ event.dateRange }}
                    </p>

                    <p class="style-description-small">
                        {{ event.meta.description.text }}
                    </p>
                </STListItem>
            </STList>

            <InfiniteObjectFetcherEnd empty-message="Geen activiteiten gevonden" :fetcher="fetcher" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Event, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { ref, Ref, watchEffect } from 'vue';
import { UIFilter } from '../filters/UIFilter';
import { useContext } from '../hooks';
import { InfiniteObjectFetcherEnd, useInfiniteObjectFetcher } from '../tables';
import EditEventView from './EditEventView.vue';

type ObjectType = Event;

const searchQuery = ref('');
const filteredCount = ref(0);
const present = usePresent()
const context = useContext();
const selectedUIFilter = ref(null) as Ref<null|UIFilter>;

const fetcher = useInfiniteObjectFetcher<ObjectType>({
    requiredFilter: getRequiredFilter(),
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

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value)
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter)
})

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur()
}

async function addEvent() {
    const event = Event.create({})

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

async function editEvent(event: Event) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventView, {
                event,
                isNew: false
            })
        ]
    })
}

function editFilter() {
    // todo
}

function extendSort(list: SortList): SortList  {
    if (list.find(l => l.key === 'id')) {
        return list;
    }

    // Always add id as an extra sort key for sorters that are not unique
    return [...list, {key: 'id', order: list[0]?.order ?? SortItemDirection.ASC}]
}


function getRequiredFilter(): StamhoofdFilter|null  {
    return null
}

</script>

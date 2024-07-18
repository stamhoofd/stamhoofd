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
                    <STListItem v-for="event of group.events" :key="event.id" class="" :selectable="true" @click="editEvent(event)">
                        <template #left>
                            <div class="calendar-box">
                                <div class="overlay">
                                    <span class="day">{{ Formatter.day(event.startDate) }}</span>
                                    <span class="month">{{ Formatter.capitalizeFirstLetter(Formatter.month(event.startDate)) }}</span>
                                </div>
                                <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" class="event-image" />
                            </div>
                        </template>

                        <h3 class="style-title-list">
                            {{ event.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ Formatter.capitalizeFirstLetter(event.dateRange) }}
                        </p>

                        <p v-if="event.meta.location?.name" class="style-description-small">
                            {{ event.meta.location.name }}
                        </p>

                        <template #right>
                            <span class="icon edit gray" />
                        </template>
                    </STListItem>
                </STList>
            </div>

            <InfiniteObjectFetcherEnd empty-message="Geen activiteiten gevonden" :fetcher="fetcher" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Event, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref, watchEffect } from 'vue';
import { UIFilter } from '../filters/UIFilter';
import { useContext } from '../hooks';
import { InfiniteObjectFetcherEnd, useInfiniteObjectFetcher } from '../tables';
import ImageComponent from '../views/ImageComponent.vue';
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

const groupedEvents = computed(() => {
    const queue: {
        title: string,
        events: Event[]
    }[] = [];
    const currentYear = Formatter.year(new Date());

    for (const event of fetcher.objects) {
        const year = Formatter.year(event.startDate);
        const title = Formatter.month(event.startDate) + (year !== currentYear ? ` ${year}` : '');

        const group = queue[queue.length - 1];
        if (group && group.title === title) {
            group.events.push(event);
        } else {
            queue.push({title, events: [event]});
        }
    }
    return queue
});

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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.calendar-box {
    width: 200px;
    border-radius: $border-radius;
    position: relative;
    padding: 40px 0;
    border-radius: 5px;
    overflow: hidden;
    background: $color-background-shade;
    margin-right: 15px;
    border: 1px solid $color-border;

    @media (max-width: 500px) {
        width: 100px;
        margin-right: 0;
        padding: 20px 0;
    }

    .overlay {
        text-align: center;

        .day {
            display: block;
            font-size: 35px;
            font-weight: bold;
        }

        .month {
            display: block;
            font-size: 15px;
            color: $color-gray-1;
        }
    }

    .event-image {
        position: absolute;
        z-index: 1;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        touch-action: none;
        pointer-events: none;

        img {
            object-fit: cover;
        }
    }
}
</style>

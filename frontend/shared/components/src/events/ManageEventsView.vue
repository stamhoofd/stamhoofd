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

            <ScrollableSegmentedControl v-model="selectedYear" :items="years" :labels="yearLabels" />
            
            <Checkbox v-if="selectedYear === null && suggestionsGroup" v-model="addSuggestions">
                Toon wekelijkse suggesties voor {{ suggestionsGroup.settings.name }}
            </Checkbox>

            <hr>

            <div v-for="(group, index) of groupedEvents" :key="group.title" class="container">
                <hr v-if="index > 0">
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

                        <p v-if="event.meta.location?.name || event.meta.location?.address?.city" class="style-description-small">
                            {{ event.meta.location?.name || event.meta.location?.address?.city }}
                        </p>

                        <template #right>
                            <span v-if="event.id" class="icon edit gray" />
                            <span v-else class="icon add gray" />
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
import { assertSort, Event, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref, watchEffect } from 'vue';
import { UIFilter } from '../filters/UIFilter';
import { useContext, useOrganization, useUser } from '../hooks';
import ScrollableSegmentedControl from '../inputs/ScrollableSegmentedControl.vue';
import { InfiniteObjectFetcherEnd, useInfiniteObjectFetcher } from '../tables';
import ImageComponent from '../views/ImageComponent.vue';
import EditEventView from './EditEventView.vue';

type ObjectType = Event;

const searchQuery = ref('');
const filteredCount = ref(0);
const present = usePresent()
const context = useContext();
const selectedUIFilter = ref(null) as Ref<null|UIFilter>;
const selectedYear = ref(null);
const years = computed(() => {
    const currentYear = Formatter.year(new Date());
    return [null, currentYear, currentYear - 1, currentYear - 2]
})
const user = useUser();
const organization = useOrganization();

const yearLabels = computed(() => {
    return years.value.map(y => {
        if (y === null) {
            return 'Toekomstige'
        }
        return y.toString()
    })
})



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
    const queue: {
        title: string,
        events: Event[]
    }[] = [];
    const currentYear = Formatter.year(new Date());

    for (const event of filledEvents.value) {
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

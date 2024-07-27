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
                        <span v-if="filteredCount > 0" class="bubble primary">{{ formatInteger(filteredCount) }}</span>
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
                    <STListItem v-for="event of group.events" :key="event.id" class="event-row right-stack smartphone-wrap-left" :selectable="true" @click="onClickEvent(event)">
                        <template #left>
                            <div class="calendar-box">
                                <div class="overlay">
                                    <span class="day">{{ Formatter.day(event.startDate) }}</span>
                                    <span class="month">{{ Formatter.capitalizeFirstLetter(Formatter.month(event.startDate)) }}</span>
                                </div>
                                <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" class="event-image" />
                            </div>
                        </template>
                        <p v-if="getEventPrefix(event)" class="style-title-prefix">
                            {{ getEventPrefix(event) }}
                        </p>
                        <h3 class="style-title-list larger">
                            <span>{{ event.name }}</span>
                        </h3>
                        <p class="style-description-small">
                            {{ Formatter.capitalizeFirstLetter(event.dateRange) }}
                        </p>

                        <p v-if="event.meta.location?.name || event.meta.location?.address?.city" class="style-description-small">
                            {{ event.meta.location?.name || event.meta.location?.address?.city }}
                        </p>

                        <p v-if="event.group" class="style-description-small">
                            <span v-if="event.group.notYetOpen">Inschrijvingen starten op {{ Formatter.date(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date()) }}</span>
                            <span v-else-if="event.group.closed">Inschrijvingen gesloten</span>
                            <span v-else>Inschrijvingen open</span>
                        </p>

                        <template #right>
                            <span v-if="!event.meta.visible" v-tooltip="'Verborgen'" class="icon gray eye-off" />
                            <span v-if="event.id" class="icon arrow-right-small gray" />
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
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { assertSort, Event, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, ref, Ref, watchEffect } from 'vue';
import { getEventUIFilterBuilders } from '../filters/filterBuilders';
import { UIFilter } from '../filters/UIFilter';
import UIFilterEditor from '../filters/UIFilterEditor.vue';
import { useContext, useOrganization, usePlatform, useUser } from '../hooks';
import ScrollableSegmentedControl from '../inputs/ScrollableSegmentedControl.vue';
import { Toast } from '../overlays/Toast';
import { InfiniteObjectFetcherEnd, useInfiniteObjectFetcher, usePositionableSheet } from '../tables';
import ImageComponent from '../views/ImageComponent.vue';
import EditEventView from './EditEventView.vue';
import EventOverview from './EventOverview.vue';

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
    return {
        startDate: {
            $gt: new Date()
        }
    }
}

function getEventPrefix(event: Event) {
    const prefixes: string[] = []
    if (event.organizationId === null) {
        prefixes.push('Nationaal')
    }

    if (event.meta.defaultAgeGroupIds !== null) {
        for (const ageGroupId of event.meta.defaultAgeGroupIds) {
            const ageGroup = platform.value?.config.defaultAgeGroups.find(g => g.id === ageGroupId)
            if (ageGroup) {
                prefixes.push(ageGroup.name)
            }
        }
    }
    return prefixes.join(' - ')
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

    @media (max-width: 450px) {
        width: 100%;
        margin-right: 0;
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

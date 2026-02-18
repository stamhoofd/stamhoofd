<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`60231186-b00f-4d07-a5c7-4a905467e254`)" />

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

            <div v-for="group of groupedEvents" :key="group.title" class="container">
                <hr><h2>{{ Formatter.capitalizeFirstLetter(group.title) }}</h2>

                <STList>
                    <EventRow v-for="event of group.events" :key="event.id" :event="event" @click="$navigate(Routes.Event, {properties: {event}})" />
                </STList>
            </div>

            <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`2a4caf43-3e88-45b6-b337-4c7036130769`)" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate } from '@simonbackx/vue-app-navigation';
import { EventRow, EventView, InfiniteObjectFetcherEnd, Toast, UIFilter, UIFilterEditor, useAppContext, useEventsObjectFetcher, useEventUIFilterBuilders, useInfiniteObjectFetcher, useOrganization, usePlatform, usePositionableSheet, useVisibilityChange } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { Event, isEmptyFilter, isEqualFilter, LimitedFilteredRequest, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, onActivated, ref, Ref, watchEffect } from 'vue';

type ObjectType = Event;

const searchQuery = ref('');
const organization = useOrganization();
const platform = usePlatform();
const $navigate = useNavigate();
const { presentPositionableSheet } = usePositionableSheet();
const memberManager = useMemberManager();

const filterBuilders = useEventUIFilterBuilders({ platform: platform.value, organizations: organization.value ? [organization.value] : (memberManager.family.organizations ?? []), app: useAppContext() });

let recommendedFilter = filterBuilders.value[0].fromFilter(memberManager.family.getRecommendedEventsFilter());
const selectedUIFilter = ref(recommendedFilter) as Ref<null | UIFilter>;

function updateRecommendedFilter() {
    const oldRecommendedFilter = recommendedFilter?.build() ?? null;

    recommendedFilter = filterBuilders.value[0].fromFilter(memberManager.family.getRecommendedEventsFilter());

    const currentFilter = selectedUIFilter.value?.build() ?? null;

    if (isEqualFilter(currentFilter, oldRecommendedFilter)) {
        selectedUIFilter.value = recommendedFilter;
    }
}

onActivated(() => {
    updateRecommendedFilter();
});

useVisibilityChange(() => {
    updateRecommendedFilter();
});

enum Routes {
    Event = 'activiteit',
}

defineRoutes([
    {
        name: Routes.Event,
        url: '@year/@slug/@id',
        component: EventView as ComponentOptions,
        params: {
            year: Number,
            slug: String,
            id: String,
        },
        paramsToProps: async (params: { year: number; slug: string; id: string }) => {
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
                };
            }
            Toast.error($t(`78228ca9-42e4-4612-a2cd-0d298f10f2a4`)).show();
            throw new Error('Event not found');
        },

        propsToParams(props) {
            if (!('event' in props) || typeof props.event !== 'object' || props.event === null || !(props.event instanceof Event)) {
                throw new Error('Missing event');
            }
            const event = props.event;

            return {
                params: {
                    year: event.startDate.getFullYear(),
                    slug: Formatter.slug(event.name),
                    id: event.id,
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

const groupedEvents = computed(() => {
    return Event.group(fetcher.objects);
});

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value);
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter);
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
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

function getRequiredFilter(): StamhoofdFilter | null {
    return {
        'startDate': {
            $gt: new Date(),
        },
        'meta.visible': true,
    };
}

</script>

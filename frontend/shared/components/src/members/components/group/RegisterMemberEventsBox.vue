<template>
    <div class="container">
        <div class="input-with-buttons">
            <div>
                <form class="input-icon-container icon search small gray" @submit.prevent="blurFocus">
                    <input v-model="searchQuery" v-autofocus="true" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" data-testid="event-search-input" :placeholder="$t(`%KC`)">
                </form>
            </div>
            <div>
                <button type="button" class="button text" @click="editFilter">
                    <span class="icon filter" />
                    <span class="hide-small">{{ $t('%2J') }}</span>
                    <span v-if="!isEmptyFilter(fetcher.baseFilter)" class="icon dot primary" />
                </button>
            </div>
        </div>

        <div v-for="group of groupedEvents" :key="group.title" class="container">
            <hr><h2>{{ Formatter.capitalizeFirstLetter(group.title) }}</h2>

            <STList>
                <EventRow v-for="event of group.events" :key="event.id" :event="event" data-testid="event-button" @click="$emit('select', event)" />
            </STList>
        </div>

        <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`%KD`)" />
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useAppContext } from '#context/appContext.ts';
import EventRow from '#events/components/EventRow.vue';
import { useEventsObjectFetcher } from '#fetchers/useEventsObjectFetcher.ts';
import { useEventUIFilterBuilders } from '#filters/filterBuilders.ts';
import type { UIFilter } from '#filters/UIFilter.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useInfiniteObjectFetcher } from '#tables/classes/InfiniteObjectFetcher.ts';
import InfiniteObjectFetcherEnd from '#tables/InfiniteObjectFetcherEnd.vue';
import { usePositionableSheet } from '#tables/usePositionableSheet.ts';
import type { Organization, PlatformMember, StamhoofdFilter } from '@stamhoofd/structures';
import { Event, isEmptyFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref, watchEffect } from 'vue';

const props = defineProps<{
    member: PlatformMember;
    organization: Organization;
}>();

defineEmits<{
    (e: 'select', event: Event): void;
}>();

type ObjectType = Event;

const app = useAppContext();
const searchQuery = ref('');
const platform = usePlatform();
const { presentPositionableSheet } = usePositionableSheet();

const organizations = computed(() => props.member.family.organizations.length > 0 ? props.member.family.organizations : [props.organization]);
const filterBuilders = useEventUIFilterBuilders({ platform: platform.value, organizations: organizations.value, app: useAppContext() });

const selectedUIFilter = ref(filterBuilders.value[0].fromFilter(props.member.family.getRecommendedEventsFilter())) as Ref<null | UIFilter>;

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
    const filter = selectedUIFilter.value ?? filterBuilders.value[0].create();
    if (!selectedUIFilter.value) {
        selectedUIFilter.value = filter;
    }

    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('#filters/UIFilterEditor.vue'), {
                    filter,
                }),
            }),
        ],
    });
}

function getRequiredFilter(): StamhoofdFilter | null {
    const filter: StamhoofdFilter = {
        startDate: {
            $gt: new Date(),
        },
        // Only events that can actually be registered for
        groupId: {
            $neq: null,
        },
    };

    if (app === 'registration') {
        filter['meta.visible'] = true;
    }

    // In organization mode there is only ever a single organization, so scope to it
    if (STAMHOOFD.userMode === 'organization' && organizations.value.length === 1) {
        filter['organizationId'] = organizations.value[0].id;
    }

    return filter;
}
</script>

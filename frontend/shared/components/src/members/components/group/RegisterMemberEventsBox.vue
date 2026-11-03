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
import { ComponentWithProperties, NavigationController } from '@browser/navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import EventRow from '#events/components/EventRow.vue';
import { useEventsObjectFetcher } from '#fetchers/useEventsObjectFetcher.ts';
import type { UIFilter } from '#filters/UIFilter.ts';
import { useInfiniteObjectFetcher } from '#tables/classes/InfiniteObjectFetcher.ts';
import InfiniteObjectFetcherEnd from '#tables/InfiniteObjectFetcherEnd.vue';
import { usePositionableSheet } from '#tables/usePositionableSheet.ts';
import type { Organization, PlatformMember } from '@stamhoofd/structures';
import { Event, isEmptyFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref, watchEffect } from 'vue';
import { useRegisterMemberEventsFilter } from './useRegisterMemberEventsFilter';

const props = defineProps<{
    member: PlatformMember;
    organization: Organization;
}>();

defineEmits<{
    (e: 'select', event: Event): void;
}>();

type ObjectType = Event;

const searchQuery = ref('');
const { presentPositionableSheet } = usePositionableSheet();

const { filterBuilders, createRecommendedUIFilter, getRequiredFilter } = useRegisterMemberEventsFilter({
    member: props.member,
    organization: () => props.organization,
});

const selectedUIFilter = ref(createRecommendedUIFilter()) as Ref<null | UIFilter>;

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
</script>

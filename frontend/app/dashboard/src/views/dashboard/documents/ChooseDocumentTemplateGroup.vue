<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ $t('%KA') }}</h1>

            <SegmentedControl v-if="tabs.length > 1" v-model="selectedTab" :items="tabs.map(t => t.id)" :labels="tabs.map(t => t.label)" />

            <div v-if="selectedTab === Tab.Activities" class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
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

            <template v-if="selectedTab === Tab.Groups">
                <p>
                    <button type="button" class="button text" @click="switchPeriod">
                        <span>{{ period.period.name }}</span>
                        <span class="icon arrow-down-small" />
                    </button>
                </p>

                <div v-for="category in categoryTree.categories" :key="category.id" class="container">
                    <hr><h2>{{ category.settings.name }}</h2>
                    <STList>
                        <STListItem v-for="group in category.groups" :key="group.id" :selectable="true" :disabled="!filterGroup(group)" @click="selectGroup(group)">
                            <template #left>
                                <GroupAvatar :group="group" />
                            </template>

                            <h3 class="style-title-list">
                                {{ group.settings.name }}
                            </h3>
                            <p class="style-description-small">
                                {{ period.period.name }}
                            </p>

                            <template #right>
                                <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ group.getMemberCount() }}</span>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </div>

                <hr><h2>{{ $t('%1IZ') }}</h2>
                <Spinner v-if="loadingGroups" />
                <STList v-else-if="archivedGroups.length">
                    <STListItem v-for="group in archivedGroups" :key="group.id" :selectable="true" @click="selectGroup(group)">
                        <template #left>
                            <GroupAvatar :group="group" />
                        </template>

                        <h3 class="style-title-list">
                            {{ group.settings.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ period.period.name }}
                        </p>
                        <template #right>
                            <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ group.getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
                <p v-else class="info-box">
                    {{ $t('%KB') }}
                </p>
            </template>

            <template v-else>
                <STList>
                    <EventRow v-for="event of fetcher.objects" :key="event.id" :event="event" :disabled="!filterGroup(event.group!)" @click="selectGroup(event.group!)" />
                </STList>
                <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`%KD`)" />
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import EventRow from '@stamhoofd/components/events/components/EventRow.vue';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import InfiniteObjectFetcherEnd from '@stamhoofd/components/tables/InfiniteObjectFetcherEnd.vue';
import { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import SegmentedControl from '@stamhoofd/components/inputs/SegmentedControl.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { UIFilter } from '@stamhoofd/components/filters/UIFilter.ts';
import UIFilterEditor from '@stamhoofd/components/filters/UIFilterEditor.vue';
import { useAppContext } from '@stamhoofd/components/context/appContext.ts';
import { useEventsObjectFetcher } from '@stamhoofd/components/fetchers/useEventsObjectFetcher.ts';
import { useEventUIFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import { useInfiniteObjectFetcher } from '@stamhoofd/components/tables/classes/InfiniteObjectFetcher.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { usePositionableSheet } from '@stamhoofd/components/tables/usePositionableSheet.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { DocumentTemplateGroup, Event, Group, GroupType, isEmptyFilter, NamedObject, SortItemDirection, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref, Ref, watchEffect } from 'vue';
import { useSwitchablePeriod } from '../../members/useSwitchablePeriod';
import { fiscal } from './definitions/fiscal';
type ObjectType = Event;

const props = defineProps<{
    year: number;
    documentType: string;
    addGroup: (group: DocumentTemplateGroup, component: NavigationActions) => Promise<void> | void;
}>();

enum Tab {
    Groups = 'Groups',
    Activities = 'Activities',
}

const organizationManager = useOrganizationManager();
const requestOwner = useRequestOwner();
const navigationActions = useNavigationActions();
const organization = useOrganization();
const platform = usePlatform();
const filterBuilders = useEventUIFilterBuilders({ platform: platform.value, organizations: organization.value ? [organization.value] : [], app: useAppContext() });
const selectedUIFilter = ref(null) as Ref<null | UIFilter>;
const { presentPositionableSheet } = usePositionableSheet();
const objectFetcher = useEventsObjectFetcher({
    get requiredFilter() {
        return getRequiredFilter();
    },
});

const fetcher = useInfiniteObjectFetcher<ObjectType>(objectFetcher);
fetcher.setSort([{
    key: 'startDate',
    order: SortItemDirection.DESC,
}]);

const groupsTab = {
    id: Tab.Groups,
    label: 'Groepen',
};

const activitiesTab = {
    id: Tab.Activities,
    label: 'Activiteiten',
};

const showOnlyActivities = props.documentType === fiscal.type && STAMHOOFD.userMode === 'platform';
const tabs = ref(showOnlyActivities ? [activitiesTab] : [groupsTab, activitiesTab]);
const title = showOnlyActivities ? $t('%1IR') : $t(`%1IL`);

const selectedTab = ref(tabs.value[0].id);

const archivedGroups = ref([]) as Ref<Group[]>;
const loadingGroups = ref(true);

const categoryTree = computed(() => period.value.getCategoryTree({ maxDepth: 1, admin: true, smartCombine: true }));
const searchQuery = ref('');

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value);
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter);
});

const { period, switchPeriod: switchPeriodHelper } = useSwitchablePeriod();

function switchPeriod(event: MouseEvent) {
    // disable periods outside of the selected year
    switchPeriodHelper(event, (p) => {
        const startYear = p.startDate.getFullYear();
        const endYear = p.endDate.getFullYear();

        return props.year >= startYear && props.year <= endYear;
    }).catch(console.error);
}

function filterGroup(group: Group): boolean {
    const startYear = group.settings.startDate.getFullYear();

    return props.year === startYear;
}

async function selectGroup(group: Group) {
    if (!filterGroup(group)) {
        if (group.type === GroupType.EventRegistration) {
            Toast.error($t('%1IU', { year: props.year })).show();
            return;
        }
        Toast.error($t('%1IV', { year: props.year })).show();
        return;
    }

    try {
        await props.addGroup(DocumentTemplateGroup.create({
            group: NamedObject.create({
                id: group.id,
                name: group.settings.name.toString(),
                description: group.type === GroupType.Membership ? period.value.period.name : (Formatter.dateRange(group.settings.startDate, group.settings.endDate)),
            }),
        }), navigationActions);
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

onMounted(() => {
    load().catch(console.error);
});

async function load() {
    try {
        archivedGroups.value = await organizationManager.value.loadArchivedGroups({ owner: requestOwner });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    loadingGroups.value = false;
}

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

function getRequiredFilter(): StamhoofdFilter | null {
    const org = organization.value;

    const filters: StamhoofdFilter = {
        groupId: {
            $neq: null,
        },
        startDate: {
            $lte: new Date(),
        },
    };

    // filter on organization tag ids, if organization lvl
    if (org) {
        filters['group'] = {
            $elemMatch: {
                organizationId: org.id,
            },
        };
    }

    return filters;
}

async function editFilter(event: MouseEvent) {
    if (!filterBuilders.value) {
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

</script>

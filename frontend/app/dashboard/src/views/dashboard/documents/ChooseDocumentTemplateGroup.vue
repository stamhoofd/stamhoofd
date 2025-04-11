<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`Inschrijvingsgroep`)" />

        <main>
            <h1>{{ $t('Kies voor welke inschrijvingen je dit document wilt aanmaken') }}</h1>

            <SegmentedControl v-model="selectedTab" :items="tabs.map(t => t.id)" :labels="tabs.map(t => t.label)" />

            <div v-if="selectedTab === Tab.Activities" class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`Zoeken`)">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">{{ $t('Filter') }}</span>
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
                        <STListItem v-for="group in category.groups" :key="group.id" :selectable="true" @click="selectGroup(group)">
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

                <hr><h2>{{ $t('Archief') }}</h2>
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
                    {{ $t('Het archief is leeg.') }}
                </p>
            </template>

            <template v-else>
                <STList>
                    <EventRow v-for="event of fetcher.objects" :key="event.id" :event="event" @click="selectGroup(event.group!)" />
                </STList>
                <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`Geen activiteiten gevonden`)" />
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { EventRow, GroupAvatar, InfiniteObjectFetcherEnd, NavigationActions, SegmentedControl, Spinner, STList, STListItem, STNavigationBar, Toast, UIFilter, UIFilterEditor, useAppContext, useEventsObjectFetcher, useEventUIFilterBuilders, useInfiniteObjectFetcher, useNavigationActions, useOrganization, usePlatform, usePositionableSheet } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { DocumentTemplateGroup, Event, Group, GroupType, isEmptyFilter, NamedObject, RecordCategory, SortItemDirection, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref, Ref, watchEffect } from 'vue';
import { useSwitchablePeriod } from '../../members/useSwitchablePeriod';
type ObjectType = Event;

const props = defineProps<{
    addGroup: (group: DocumentTemplateGroup, component: NavigationActions) => Promise<void> | void;
    fieldCategories: RecordCategory[];
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

const tabs = ref([{
    id: Tab.Groups,
    label: 'Groepen',
}, {
    id: Tab.Activities,
    label: 'Activiteiten',
}]);
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

const { period, switchPeriod } = useSwitchablePeriod();

async function selectGroup(group: Group) {
    try {
        await props.addGroup(DocumentTemplateGroup.create({
            group: NamedObject.create({
                id: group.id,
                name: group.settings.name,
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

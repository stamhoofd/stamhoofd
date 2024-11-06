<template>
    <div class="st-view">
        <STNavigationBar title="Inschrijvingsgroep" />

        <main>
            <h1>Kies voor welke inschrijvingen je dit document wilt aanmaken</h1>

            <SegmentedControl v-model="selectedTab" :items="tabs.map(t => t.id)" :labels="tabs.map(t => t.label)" />

            <form v-if="selectedTab === Tab.Activities" class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
            </form>

            <template v-if="selectedTab === Tab.Groups">
                <p>
                    <button type="button" class="button text" @click="switchPeriod">
                        <span>{{ period.period.name }}</span>
                        <span class="icon arrow-down-small" />
                    </button>
                </p>

                <div v-for="category in categoryTree.categories" :key="category.id" class="container">
                    <hr>
                    <h2>{{ category.settings.name }}</h2>
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

                <hr>
                <h2>Archief</h2>
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
                    Het archief is leeg.
                </p>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { GroupAvatar, NavigationActions, SegmentedControl, Spinner, STList, STListItem, STNavigationBar, Toast, useNavigationActions } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { DocumentTemplateGroup, Group, GroupType, NamedObject, RecordCategory } from '@stamhoofd/structures';
import { computed, onMounted, ref, Ref } from 'vue';
import { useSwitchablePeriod } from '../../members/useSwitchablePeriod';

const props = defineProps<{
    addGroup: (group: DocumentTemplateGroup, component: NavigationActions) => Promise<void>|void;
    fieldCategories: RecordCategory[];
}>();

enum Tab {
    Groups = 'Groups',
    Activities = 'Activities',
}

const organizationManager = useOrganizationManager();
const requestOwner = useRequestOwner();
const navigationActions = useNavigationActions();
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

const { period, switchPeriod } = useSwitchablePeriod();

async function selectGroup(group: Group) {
    try {
        await props.addGroup(DocumentTemplateGroup.create({
            group: NamedObject.create({
                id: group.id,
                name: group.settings.name,
                description: group.type === GroupType.Membership ? period.value.period.name : undefined,
            }),
        }), navigationActions);
    } catch (e) {
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
</script>

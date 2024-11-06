<template>
    <div class="st-view">
        <STNavigationBar title="Inschrijvingsgroep" />

        <main>
            <h1>Kies voor welke inschrijvingen je dit document wilt aanmaken</h1>

            <SegmentedControl :items="['Groepen', 'Activiteiten']" />

            <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
            </form>

            <p>
                <button type="button" class="button text">
                    <span>Werkjaar: xxxx</span>
                    <span class="icon arrow-down-small" />
                </button>
            </p>

            <div v-for="category in categoryTree.categories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.settings.name }}</h2>
                <STList>
                    <STListItem v-for="group in category.groups" :key="group.id" :selectable="true" @click="selectGroup(group)">
                        <h2 class="style-title-list">
                            {{ group.settings.name }}
                        </h2>
                        <template #right>
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
                    <h2 class="style-title-list">
                        {{ group.settings.name }}
                    </h2>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                Het archief is leeg.
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { NavigationActions, SegmentedControl, Spinner, STList, STListItem, STNavigationBar, Toast, useNavigationActions, useRequiredOrganization } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { DocumentTemplateGroup, Group, RecordCategory } from '@stamhoofd/structures';
import { computed, onMounted, ref, Ref } from 'vue';

const props = defineProps<{
    addGroup: (group: DocumentTemplateGroup, component: NavigationActions) => void;
    fieldCategories: RecordCategory[];
}>();

const organization = useRequiredOrganization();
const organizationManager = useOrganizationManager();
const requestOwner = useRequestOwner();
const navigationActions = useNavigationActions();

const archivedGroups = ref([]) as Ref<Group[]>;
const loadingGroups = ref(true);

const categoryTree = computed(() => organization.value.getCategoryTree({ maxDepth: 1, admin: true, smartCombine: true }));
const searchQuery = ref('');

function selectGroup(group: Group) {
    props.addGroup(DocumentTemplateGroup.create({
        groupId: group.id,
        cycle: group.cycle,
    }), navigationActions);
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

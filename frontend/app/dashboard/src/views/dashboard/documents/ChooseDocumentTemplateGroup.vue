<template>
    <div class="st-view">
        <STNavigationBar title="Inschrijvingsgroep" />

        <main>
            <h1>Kies een inschrijvingsgroep</h1>

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
import { NavigationActions, Spinner, STList, STListItem, STNavigationBar, Toast, useNavigationActions, useRequiredOrganization } from '@stamhoofd/components';
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
</script>

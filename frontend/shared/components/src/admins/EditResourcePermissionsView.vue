<template>
    <SaveView :title="title" :disabled="!hasChanges" :save-text="$t('Opslaan')" @save="save">
        <h1>{{ title }}</h1>

        <div class="input-with-buttons">
            <div>
                <form novalidate class="input-icon-container icon search small gray" @submit.prevent="blurFocus">
                    <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
                </form>
            </div>
            <div>
                <button type="button" class="button text" @click="switchPeriod">
                    <span>{{ period.period.name }}</span>
                    <span class="icon arrow-down-small" />
                </button>
            </div>
        </div>

        <p v-if="filteredResources.length === 0" class="info-box">
            {{ emptyText }}
        </p>
        <STList v-else>
            <ResourcePermissionRow v-for="resource in filteredResources" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="configurableAccessRights" type="resource" @patch:role="addPatch" />
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { usePatch } from '#hooks/usePatch.ts';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { useSwitchablePeriod } from '#hooks/useSwitchablePeriod.ts';
import type { AccessRight, PermissionRoleDetailed, PermissionRoleForResponsibility } from '@stamhoofd/structures';
import { getGroupTypeName, GroupType, PermissionsResourceType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import ResourcePermissionRow from './components/ResourcePermissionRow.vue';

const props = withDefaults(
    defineProps<{
        title: string;
        role: PermissionRoleDetailed | PermissionRoleForResponsibility;
        inheritedRoles?: (PermissionRoleDetailed | PermissionRoleForResponsibility)[];
        type: PermissionsResourceType.Groups | PermissionsResourceType.GroupCategories;
        configurableAccessRights?: AccessRight[] | null;
        saveHandler: (patch: AutoEncoderPatchType<PermissionRoleDetailed | PermissionRoleForResponsibility>) => void;
    }>(), {
        inheritedRoles: () => [],
        configurableAccessRights: null,
    },
);

const pop = usePop();
const { patched, addPatch, patch, hasChanges } = usePatch(props.role);
const { period, switchPeriod } = useSwitchablePeriod();

const searchQuery = ref('');

const resources = computed(() => {
    if (props.type === PermissionsResourceType.Groups) {
        return [
            ...period.value.adminCategoryTree.getAllGroups(),
            ...period.value.waitingLists,
        ].map(group => ({
            id: group.id,
            name: group.settings.getNameWithPeriod(),
            type: props.type,
            description: group.type === GroupType.WaitingList ? getGroupTypeName(group.type) : undefined,
        }));
    }

    return period.value.adminCategoryTree.getAllCategories().map(category => ({
        id: category.id,
        name: category.getName(period.value) + ' (' + period.value.period.nameShort + ')',
        type: props.type,
    }));
});

const filteredResources = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) {
        return resources.value;
    }
    return resources.value.filter(r => r.name.toLowerCase().includes(query));
});

const emptyText = computed(() => {
    if (searchQuery.value) {
        return $t('%1AX');
    }

    if (props.type === PermissionsResourceType.Groups) {
        return $t('Er zijn geen inschrijvingsgroepen in deze periode.');
    }

    return $t('Er zijn geen inschrijvingscategorieën in deze periode.');
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

async function save() {
    props.saveHandler(patch.value);
    await pop({ force: true });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
};

defineExpose({
    shouldNavigateAway,
});
</script>

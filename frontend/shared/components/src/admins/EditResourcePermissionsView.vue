<template>
    <SaveView :title="title" :disabled="!hasChanges" :save-text="$t('Opslaan')" @save="save">
        <h1>{{ title }}</h1>

        <div class="input-with-buttons">
            <div>
                <form novalidate class="input-icon-container icon search small gray" @submit.prevent="blurFocus">
                    <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
                </form>
            </div>
            <div v-if="period">
                <button type="button" class="button text" @click="switchPeriod">
                    <span>{{ period.period.name }}</span>
                    <span class="icon arrow-down-small" />
                </button>
            </div>
        </div>

        <p v-if="filteredResources.length === 0" class="info-box">
            {{
                searchQuery
                    ? $t('%1AX')
                    : period
                        ? $t('Er zijn geen {resourceType} in werkjaar {period}.', { resourceType: getPermissionResourceTypeName(props.type, true), period: period.period.name })
                        : $t('Er zijn geen {resourceType}.', { resourceType: getPermissionResourceTypeName(props.type, true) })
            }}
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
import type { AccessRight, OrganizationRegistrationPeriod, PermissionRoleDetailed, PermissionRoleForResponsibility, PermissionsResourceType } from '@stamhoofd/structures';
import { getPermissionResourceTypeName, isPeriodScopedResourceType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import ResourcePermissionRow from './components/ResourcePermissionRow.vue';

const props = withDefaults(
    defineProps<{
        title: string;
        role: PermissionRoleDetailed | PermissionRoleForResponsibility;
        inheritedRoles?: (PermissionRoleDetailed | PermissionRoleForResponsibility)[];
        type: PermissionsResourceType;
        configurableAccessRights?: AccessRight[] | null;
        saveHandler: (patch: AutoEncoderPatchType<PermissionRoleDetailed | PermissionRoleForResponsibility>) => void;
        getResources: (period: OrganizationRegistrationPeriod | null) => { id: string; name: string; type: PermissionsResourceType; description?: string }[];
    }>(), {
        inheritedRoles: () => [],
        configurableAccessRights: null,
    },
);

const pop = usePop();
const { patched, addPatch, patch, hasChanges } = usePatch(props.role);
const isPeriodScoped = isPeriodScopedResourceType(props.type);
const switchable = isPeriodScoped ? useSwitchablePeriod() : undefined;
const period = switchable?.period;

async function switchPeriod(event: MouseEvent) {
    await switchable?.switchPeriod(event);
}

const searchQuery = ref('');

const resources = computed(() => props.getResources(period?.value ?? null));

const filteredResources = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) {
        return resources.value;
    }
    return resources.value.filter(r => r.name.toLowerCase().includes(query));
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
    return await CenteredMessage.confirm({
        title: $t(`%A0`),
        confirmText: $t(`%4X`),
    });
};

defineExpose({
    shouldNavigateAway,
});
</script>

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
                    <span>{{ period.name }}</span>
                    <span class="icon arrow-down-small" />
                </button>
            </div>
        </div>

        <Spinner v-if="loading" />
        <p v-else-if="filteredResources.length === 0" class="info-box">
            {{
                searchQuery
                    ? $t('%1AX')
                    : period
                        ? $t('Er zijn geen {resourceType} in werkjaar {period}.', { resourceType: getPermissionResourceTypeName(props.type, true), period: period.name })
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
import { Toast } from '#overlays/Toast.ts';
import Spinner from '#Spinner.vue';
import { useSwitchablePeriod } from '#hooks/useSwitchablePeriod.ts';
import type { AccessRight, OrganizationRegistrationPeriod, PermissionRoleDetailed, PermissionRoleForResponsibility, PermissionsResourceType, RegistrationPeriod } from '@stamhoofd/structures';
import { getPermissionResourceTypeName, isPeriodScopedResourceType } from '@stamhoofd/structures';
import { throttle } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';
import ResourcePermissionRow from './components/ResourcePermissionRow.vue';

type Resource = { id: string; name: string; type: PermissionsResourceType; description?: string };

const props = withDefaults(
    defineProps<{
        title: string;
        role: PermissionRoleDetailed | PermissionRoleForResponsibility;
        inheritedRoles?: (PermissionRoleDetailed | PermissionRoleForResponsibility)[];
        type: PermissionsResourceType;
        configurableAccessRights?: AccessRight[] | null;
        saveHandler: (patch: AutoEncoderPatchType<PermissionRoleDetailed | PermissionRoleForResponsibility>) => void;
        getResources: (options: { period: RegistrationPeriod | null; organizationPeriod: OrganizationRegistrationPeriod | null; search: string }) => Resource[] | Promise<Resource[]>;
    }>(), {
        inheritedRoles: () => [],
        configurableAccessRights: null,
    },
);

const pop = usePop();
const { patched, addPatch, patch, hasChanges } = usePatch(props.role);
const isPeriodScoped = isPeriodScopedResourceType(props.type);
const switchable = isPeriodScoped ? useSwitchablePeriod({ onSwitch: () => loadResources() }) : undefined;
const period = switchable?.period;
const organizationPeriod = switchable?.organizationPeriod;

async function switchPeriod(event: MouseEvent) {
    await switchable?.switchPeriod(event);
}

const searchQuery = ref('');
const resources = ref<Resource[]>([]) as Ref<Resource[]>;
const loading = ref(false);
let loadCount = 0;

async function loadResources() {
    const count = ++loadCount;
    loading.value = true;

    try {
        const result = await props.getResources({
            period: period?.value ?? null,
            organizationPeriod: organizationPeriod?.value ?? null,
            search: searchQuery.value.trim(),
        });

        if (count !== loadCount) {
            // A newer request has started already
            return;
        }
        resources.value = result;
    }
    catch (e) {
        if (count !== loadCount) {
            return;
        }
        resources.value = [];
        Toast.fromError(e).show();
    }
    loading.value = false;
}

const throttledLoadResources = throttle(() => void loadResources(), 500);
watch(searchQuery, () => throttledLoadResources());
void loadResources();

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

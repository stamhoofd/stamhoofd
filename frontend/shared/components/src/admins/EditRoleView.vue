<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-if="!isForResponsibility" error-fields="name" :error-box="errors.errorBox" :title="$t(`cbe7db4a-b65b-452b-a5d2-d369182fd28f`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`8edda6d9-057a-4740-89f3-a226b8fd4950`)">
        </STInputBox>

        <hr><h2>{{ $t('27778acf-5730-4c2d-8337-0a84ba47f3f1') }}</h2>
        <p>{{ $t('bf7f8c10-b6b5-4edb-90d8-a550d061dea6') }}</p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" value="None" :disabled="lockedMinimumLevel !== PermissionLevel.None" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('45ff02db-f404-4d91-853f-738d55c40cb6') }}
                </h3>
                <p v-if="basePermission === 'None'" class="style-description-small">
                    {{ $t('1d66f70e-1a42-4479-9e27-683e3f536ccd') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" :value="PermissionLevel.Full" :disabled="lockedMinimumLevel !== PermissionLevel.None" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('c2296305-99a9-497a-aed3-7bb3d2293ce8') }}
                </h3>
                <p v-if="basePermission === PermissionLevel.Full" class="style-description-small">
                    {{ $t('4610ce3e-5b1e-40d6-8d62-888dc54d2bb9') }}
                </p>
            </STListItem>
        </STList>

        <template v-if="basePermission !== PermissionLevel.Full">
            <template v-if="app === 'admin' && (scope === null || scope === 'admin')">
                <hr><h2>
                    {{ $t('d431d7b4-8cdd-4307-bb73-2c570fc1a0fa') }}
                </h2>

                <p>{{ $t('31982300-fbbf-4f5a-b7ce-26738bd2b23d') }}</p>

                <STList>
                    <ResourcePermissionRow :role="patched" :resource="{id: '', name: 'Alle verenigingen', type: PermissionsResourceType.OrganizationTags }" :inherited-roles="inheritedRoles" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="tag in tags" :key="tag.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: tag.id, name: tag.name, type: PermissionsResourceType.OrganizationTags }" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.OrganizationTags, patched, tags)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </template>

            <template v-if="enableActivities && categories.length">
                <hr><h2>
                    {{ $t('376152ba-a238-451e-a2ce-5a9d4ff69e67') }}
                </h2>
                <p>{{ $t('8ff93aca-241e-478f-8e71-f9abd17d2fa5') }}</p>

                <STList>
                    <ResourcePermissionRow v-for="category in categories" :key="category.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: category.id, name: category.settings.name, type: PermissionsResourceType.GroupCategories }" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.GroupCategories, patched, categories)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </template>

            <div v-if="enableMemberModule && groups.length" class="container">
                <hr><h2>
                    {{ $t('1c68dc61-88b4-4adc-9059-67768a473867') }}
                </h2>

                <STList>
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: $t('62db60da-ef20-4b61-8b69-4541deb5e8db'), type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="group in groups" :key="group.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: group.id, name: group.settings.name + ' ('+(group.settings.period?.nameShort ?? '?')+')', type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.Groups, patched, groups)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </div>

            <div v-if="enableWebshopModule" class="container">
                <hr><h2>{{ $t('e85a86ee-7751-4791-984b-f67dc1106f6b') }}</h2>
                <p>{{ $t('0b8c6bb0-a953-45b6-8a2c-088d5468f743') }}</p>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationCreateWebshops" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: $t('3ab7a167-91be-4ac4-af06-f7b4cd7d18f0'), type: PermissionsResourceType.Webshops }" :configurable-access-rights="[]" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="webshop in webshops" :key="webshop.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: webshop.id, name: webshop.meta.name, type: PermissionsResourceType.Webshops }" :configurable-access-rights="webshop.hasTickets ? [AccessRight.WebshopScanTickets] : []" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.Webshops, patched, webshops)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.WebshopScanTickets]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </div>

            <div v-if="app !== 'admin' || scope === 'organization'" class="container">
                <hr><h2>
                    {{ $t('3fcb229b-451c-4c81-8934-5ee65059907c') }}
                </h2>
                <p>{{ $t('3ac48a57-5af2-449a-91d0-8a98ffe2284f') }}</p>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.MemberReadFinancialData" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.MemberWriteFinancialData" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.MemberManageNRN" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="{recordCategory, organization} in recordCategories" :key="recordCategory.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: recordCategory.id, name: recordCategory.name.toString(), type: PermissionsResourceType.RecordCategories, description: !organization ? $t('1dfaeb07-5f01-42c7-a9a4-0096047da86e') : $t('4dea71e9-0965-4c9a-81ac-6ee7046a0d8e') }" :configurable-access-rights="[]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.RecordCategories, patched, recordCategories.map(r => r.recordCategory))" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </div>

            <template v-if="app !== 'admin' || scope === 'organization'">
                <hr><h2>{{ $t('5d5cb596-1b5b-4ec3-98dd-2c0f012d9093') }}</h2>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationFinanceDirector" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationManagePayments" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />
                </STList>
            </template>
        </template>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr><h2 v-if="responsibility">
                {{ $t('ab8181ca-a193-4cb3-a476-501b4d9196d3') }}
            </h2>
            <h2 v-else>
                {{ $t('b36cd1f7-9923-433b-93d8-605ac65a4718') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>

        <template v-if="!isNew && !responsibility">
            <hr><h2>{{ $t('f30d6db4-12bf-4048-a31c-3e0d8ee3e935') }}</h2>

            <Spinner v-if="loading" />
            <template v-else>
                <p v-if="filteredAdmins.length === 0" class="info-box">
                    {{ $t('8edaef10-547b-4f3a-9a23-94380305b061') }}
                </p>
                <STList v-else>
                    <STListItem v-for="admin in filteredAdmins" :key="admin.id">
                        <h2 class="style-title-list">
                            {{ admin.firstName }} {{ admin.lastName }}
                        </h2>
                        <p class="style-description-small">
                            {{ admin.email }}
                        </p>
                    </STListItem>
                </STList>
            </template>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SaveView, Spinner, useAppContext, useAuth, useErrors, useOrganization, usePatch, usePlatform } from '@stamhoofd/components';
import { AccessRight, getUnlistedResources, Group, GroupCategory, maximumPermissionlevel, PermissionLevel, PermissionRoleDetailed, PermissionRoleForResponsibility, PermissionsResourceType, User, WebshopPreview } from '@stamhoofd/structures';
import { computed, Ref, ref } from 'vue';
import AccessRightPermissionRow from './components/AccessRightPermissionRow.vue';
import ResourcePermissionRow from './components/ResourcePermissionRow.vue';
import { useAdmins } from './hooks/useAdmins';

const errors = useErrors();
const auth = useAuth();
const saving = ref(false);
const deleting = ref(false);

const props = withDefaults(
    defineProps<{
        role: PermissionRoleDetailed | PermissionRoleForResponsibility;
        inheritedRoles: (PermissionRoleDetailed | PermissionRoleForResponsibility)[];
        isNew: boolean;
        saveHandler: (p: AutoEncoderPatchType<PermissionRoleDetailed | PermissionRoleForResponsibility>) => Promise<void>;
        deleteHandler: (() => Promise<void>) | null;
        scope?: 'organization' | 'admin' | null;
    }>(), {
        scope: null,
        inheritedRoles: () => [],
        deleteHandler: null,
    },
);

const app = useAppContext();
const enableWebshopModule = computed(() => (organization.value?.meta?.packages.useWebshops ?? false));
const enableMemberModule = computed(() => organization.value?.meta?.packages.useMembers ?? false);
const enableActivities = computed(() => organization.value?.meta?.packages.useActivities ?? false);
const pop = usePop();
const isForResponsibility = props.role instanceof PermissionRoleForResponsibility;
const responsibility = computed(() => {
    if (!(props.role instanceof PermissionRoleForResponsibility)) {
        return null;
    }

    const rid = props.role.responsibilityId;
    return platform.value.config.responsibilities.find(r => r.id === rid) ?? null;
});

const title = computed(() => {
    if (props.role instanceof PermissionRoleForResponsibility) {
        return $t(`055ba4d1-abf5-4c10-9da1-29311a113568`) + ' ' + props.role.name;
    }
    return props.isNew ? $t(`db4cb26a-c23f-4f29-b4c3-233cd0f08f38`) : props.role.name;
});

const { sortedAdmins, loading, getUnloadedPermissions } = useAdmins();
const organization = useOrganization();
const platform = usePlatform();
const { patched, addPatch, hasChanges, patch } = usePatch(props.role);
const groups: Ref<Group[]> = computed(() => [
    ...(organization.value?.adminAvailableGroups ?? []),
    ...(organization.value?.period.waitingLists ?? []),
]);
const webshops: Ref<WebshopPreview[]> = computed(() => organization.value?.webshops ?? []);
const categories: Ref<GroupCategory[]> = computed(() => organization.value?.getCategoryTree({ permissions: auth.permissions }).categories ?? []);
const tags = computed(() => platform.value.config.tags);
const recordCategories = computed(() => {
    const base = (organization.value?.meta.recordsConfiguration.recordCategories?.slice() ?? []).map(r => ({
        organization: organization.value,
        recordCategory: r,
    }));

    for (const r of platform.value.config.recordsConfiguration.recordCategories) {
        base.push({
            organization: null,
            recordCategory: r,
        });
    }

    return base;
});

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (!isForResponsibility && name.value.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`0b7bedcd-0e5a-4ef3-b2d8-7ee2c23650e5`),
                field: 'name',
            });
        }
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t(`4d88b931-3fa4-497d-8a23-481f8f58a967`), $t(`25d866b7-3859-4a5d-b875-bc286e69f846`))) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const hasAdminRole = (admin: User) => {
    const permissions = getUnloadedPermissions(admin);
    return permissions?.hasRole(props.role) ?? false;
};

const filteredAdmins = computed(() => sortedAdmins.value.filter(a => hasAdminRole(a)));

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const lockedMinimumLevel = computed(() => {
    const arr: PermissionLevel[] = [];

    for (const role of props.inheritedRoles) {
        arr.push(role.level);
    }

    return maximumPermissionlevel(...arr);
});

const basePermission = computed({
    get: () => maximumPermissionlevel(lockedMinimumLevel.value, patched.value.level),
    set: level => addPatch({ level }),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`3953d383-4f04-42ea-83cd-bf65478ed4a9`), $t(`4cfb2940-8532-446e-b543-a4c7ba9618a3`));
};

defineExpose({
    shouldNavigateAway,
});
</script>

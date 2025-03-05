<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox v-if="!isForResponsibility" error-fields="name" :error-box="errors.errorBox" :title="$t(`04043e8a-6a58-488e-b538-fea133738532`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`38512840-e47f-4e70-b952-87b475b683bb`)"></STInputBox>

        <hr><h2>{{ $t('3a58c990-f036-4fac-902c-f10778678e1c') }}</h2>
        <p>{{ $t('d9e09831-02c3-474a-8f16-f7a6bd646811') }}</p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" value="None" :disabled="lockedMinimumLevel !== PermissionLevel.None"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('039ea891-15aa-42d4-8513-7f29d0743514') }}
                </h3>
                <p v-if="basePermission === 'None'" class="style-description-small">
                    {{ $t('a18f3e6e-c51c-42f1-b81c-71cbb0b78820') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" :value="PermissionLevel.Full" :disabled="lockedMinimumLevel !== PermissionLevel.None"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('0748bf05-edf7-4787-a751-9e371dad19cc') }}
                </h3>
                <p v-if="basePermission === PermissionLevel.Full" class="style-description-small">
                    {{ $t('c2b3cb0f-39e2-4bc9-9cfb-15b41db06ba0') }}
                </p>
            </STListItem>
        </STList>

        <template v-if="basePermission !== PermissionLevel.Full">
            <template v-if="app === 'admin' && (scope === null || scope === 'admin')">
                <hr><h2>
                    {{ $t('ce583548-f4f4-46e4-9b53-f3fcc715a30e') }}
                </h2>

                <p>{{ $t('279c702a-c084-4d2f-bfc0-338085913b61') }}</p>

                <STList>
                    <ResourcePermissionRow :role="patched" :resource="{id: '', name: 'Alle verenigingen', type: PermissionsResourceType.OrganizationTags }" :inherited-roles="inheritedRoles" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch"/>

                    <ResourcePermissionRow v-for="tag in tags" :key="tag.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: tag.id, name: tag.name, type: PermissionsResourceType.OrganizationTags }" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch"/>

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.OrganizationTags, patched, tags)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch" :unlisted="true"/>
                </STList>
            </template>

            <template v-if="enableActivities && categories.length">
                <hr><h2>
                    {{ $t('3b7c5a06-acee-41a5-8cb5-2bb3a7bbed6e') }}
                </h2>
                <p>{{ $t('1fcd8f86-178c-4a06-b86e-c9ef25655197') }}</p>

                <STList>
                    <ResourcePermissionRow v-for="category in categories" :key="category.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: category.id, name: category.settings.name, type: PermissionsResourceType.GroupCategories }" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" @patch:role="addPatch"/>

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.GroupCategories, patched, categories)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" @patch:role="addPatch" :unlisted="true"/>
                </STList>
            </template>

            <div v-if="enableMemberModule && groups.length" class="container">
                <hr><h2>
                    {{ $t('f7a81ba4-96ed-4883-8e31-95dd625635e2') }}
                </h2>

                <STList>
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: 'Alle groepen', type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch"/>
                    <ResourcePermissionRow v-for="group in groups" :key="group.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: group.id, name: group.settings.name + ' ('+(group.settings.period?.nameShort ?? '?')+')', type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch"/>

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.Groups, patched, groups)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" :unlisted="true"/>
                </STList>
            </div>

            <div v-if="enableWebshopModule" class="container">
                <hr><h2>{{ $t('c280fdd0-fa09-4a5e-a6b1-6bc0aa152e53') }}</h2>
                <p>{{ $t('ad40cc39-ae25-4b33-b142-e36571b97526') }}</p>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationCreateWebshops" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch"/>
                    <ResourcePermissionRow v-for="webshop in webshops" :key="webshop.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: webshop.id, name: webshop.meta.name, type: PermissionsResourceType.Webshops }" :configurable-access-rights="webshop.hasTickets ? [AccessRight.WebshopScanTickets] : []" type="resource" @patch:role="addPatch"/>

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.Webshops, patched, webshops)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.WebshopScanTickets]" type="resource" @patch:role="addPatch" :unlisted="true"/>
                </STList>
            </div>

            <div v-if="app !== 'admin' || scope === 'organization'" class="container">
                <hr><h2>
                    {{ $t('8b8b2027-48e5-4dda-bbd9-0c36d56e01df') }}
                </h2>
                <p>{{ $t('48b51b96-0613-4ba9-8c40-e10391f1120a') }}</p>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.MemberReadFinancialData" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch"/>

                    <AccessRightPermissionRow :access-right="AccessRight.MemberWriteFinancialData" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch"/>

                    <AccessRightPermissionRow :access-right="AccessRight.MemberManageNRN" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch"/>

                    <ResourcePermissionRow v-for="recordCategory in recordCategories" :key="recordCategory.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: recordCategory.id, name: recordCategory.name, type: PermissionsResourceType.RecordCategories }" :configurable-access-rights="[]" type="resource" @patch:role="addPatch"/>

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.RecordCategories, patched, recordCategories)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[]" type="resource" @patch:role="addPatch" :unlisted="true"/>
                </STList>
            </div>

            <template v-if="app !== 'admin' || scope === 'organization'">
                <hr><h2>{{ $t('dd4005f0-77d2-4eba-ad52-170c4b32cc12') }}</h2>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationFinanceDirector" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch"/>

                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationManagePayments" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch"/>
                </STList>
            </template>
        </template>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr><h2 v-if="responsibility">
                {{ $t('7cd028d4-d06e-4477-9200-bcfc2099f414') }}
            </h2>
            <h2 v-else>
                {{ $t('61a60bf0-46b0-4e7b-95e2-82eb573303e1') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
            </button>
        </div>

        <template v-if="!isNew && !responsibility">
            <hr><h2>{{ $t('e008444e-cacd-4cf1-9569-a259fbe69c86') }}</h2>

            <Spinner v-if="loading"/>
            <template v-else>
                <p v-if="filteredAdmins.length === 0" class="info-box">
                    {{ $t('974af31f-591b-4911-9a64-f074fa7d5970') }}
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
        return 'Rechten voor ' + props.role.name;
    }
    return props.isNew ? 'Nieuwe rol' : props.role.name;
});

const { sortedAdmins, loading, getPermissions, getUnloadedPermissions } = useAdmins();
const organization = useOrganization();
const platform = usePlatform();
const { patched, addPatch, hasChanges, patch } = usePatch(props.role);
const groups: Ref<Group[]> = computed(() => organization.value?.adminAvailableGroups ?? []);
const webshops: Ref<WebshopPreview[]> = computed(() => organization.value?.webshops ?? []);
const categories: Ref<GroupCategory[]> = computed(() => organization.value?.getCategoryTree({ permissions: auth.permissions }).categories ?? []);
const tags = computed(() => platform.value.config.tags);
const recordCategories = computed(() => {
    const base = organization.value?.meta.recordsConfiguration.recordCategories?.slice() ?? [];

    for (const r of platform.value.config.recordsConfiguration.recordCategories) {
        if (r.defaultEnabled) {
            base.push(r);
        }
        else {
            if (organization.value?.meta.recordsConfiguration.inheritedRecordCategories.has(r.id)) {
                base.push(r);
            }
        }
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
                message: 'Gelieve een titel in te vullen',
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

    if (!await CenteredMessage.confirm('Ben je zeker dat je deze rol wilt verwijderen?', 'Verwijderen')) {
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
    const arr = [];

    for (const role of props.inheritedRoles) {
        arr.push(role.level);
    }

    return maximumPermissionlevel(...arr);
});

const basePermission = computed({
    get: () => maximumPermissionlevel(lockedMinimumLevel.value, patched.value.level),
    set: level => addPatch({ level }),
});

const createWebshops = useAccessRightSetter(AccessRight.OrganizationCreateWebshops);
const financeDirector = useAccessRightSetter(AccessRight.OrganizationFinanceDirector);
const managePayments = useAccessRightSetter(AccessRight.OrganizationManagePayments);

const readFinancialData = useAccessRightSetter(AccessRight.MemberReadFinancialData);
const writeFinancialData = useAccessRightSetter(AccessRight.MemberWriteFinancialData);

function useAccessRightSetter(accessRight: AccessRight) {
    return computed({
        get: () => patched.value.hasAccessRight(accessRight),
        set: (value) => {
            const patch = PermissionRoleDetailed.patch({});

            // Always delete to prevent duplicate insertions
            patch.accessRights.addDelete(accessRight);
            if (value) {
                patch.accessRights.addPut(accessRight);
            }

            addPatch(patch);
        },
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});
</script>

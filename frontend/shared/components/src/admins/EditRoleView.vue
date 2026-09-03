<template>
    <CategorizedView :title="title" :loading="saving" :deleting="deleting" :disabled="!hasChanges" @save="save" v-on="canDelete ? {delete: doDelete} : {}">
        <STErrorsDefault :error-box="errors.errorBox" />

        <CategorizedBox v-if="!isForResponsibility" icon="settings" :title="$t('%Lb')">
            <template #summary>
                <p class="style-description-small">
                    {{ name }}
                </p>
            </template>

            <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%vC`)">
                <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%ZF`)">
            </STInputBox>
        </CategorizedBox>

        <CategorizedBox icon="key" :title="$t('%Yy')">
            <template #summary>
                <p class="style-description-small">
                    {{ getPermissionLevelName(basePermission) }}
                </p>
            </template>

            <p>{{ $t('%Yz') }}</p>

            <STList>
                <STListItem :selectable="!isLevelLocked(PermissionLevel.None)" :disabled="isLevelLocked(PermissionLevel.None)" element-name="label">
                    <template #left>
                        <Radio v-model="basePermission" :value="PermissionLevel.None" :disabled="isLevelLocked(PermissionLevel.None)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ getPermissionLevelName(PermissionLevel.None) }}
                    </h3>
                    <p v-if="basePermission === PermissionLevel.None" class="style-description-small">
                        {{ $t('%Z0') }}
                    </p>
                </STListItem>

                <STListItem v-if="basePermission === PermissionLevel.Read || auth.hasPlatformFullAccess()" :selectable="!isLevelLocked(PermissionLevel.Read)" :disabled="isLevelLocked(PermissionLevel.Read)" element-name="label">
                    <template #left>
                        <Radio v-model="basePermission" :value="PermissionLevel.Read" :disabled="isLevelLocked(PermissionLevel.Read)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ getPermissionLevelName(PermissionLevel.Read) }}
                    </h3>
                </STListItem>

                <STListItem v-if="basePermission === PermissionLevel.Write || auth.hasPlatformFullAccess()" :selectable="!isLevelLocked(PermissionLevel.Write)" :disabled="isLevelLocked(PermissionLevel.Write)" element-name="label">
                    <template #left>
                        <Radio v-model="basePermission" :value="PermissionLevel.Write" :disabled="isLevelLocked(PermissionLevel.Write)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ getPermissionLevelName(PermissionLevel.Write) }}
                    </h3>
                </STListItem>

                <STListItem :selectable="!isLevelLocked(PermissionLevel.Full)" :disabled="isLevelLocked(PermissionLevel.Full)" element-name="label">
                    <template #left>
                        <Radio v-model="basePermission" :value="PermissionLevel.Full" :disabled="isLevelLocked(PermissionLevel.Full)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ getPermissionLevelName(PermissionLevel.Full) }}
                    </h3>
                    <p v-if="basePermission === PermissionLevel.Full" class="style-description-small">
                        {{ $t('%Z2') }}
                    </p>
                </STListItem>
            </STList>
        </CategorizedBox>

        <template v-if="basePermission !== PermissionLevel.Full">
            <CategorizedBox v-if="app === 'admin' && (scope === null || scope === 'admin')" icon="company" :title="$t('%Z3')">
                <p>{{ $t('%Z4') }}</p>

                <STList>
                    <ResourcePermissionRow :role="patched" :resource="{id: '', name: $t('%53'), type: PermissionsResourceType.OrganizationTags }" :inherited-roles="inheritedRoles" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="tag in tags" :key="tag.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: tag.id, name: tag.name, type: PermissionsResourceType.OrganizationTags }" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.OrganizationTags, patched, tags)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </CategorizedBox>

            <CategorizedBox v-if="categories.length" icon="folder" :title="$t('%Z5')">
                <p>{{ $t('%Z6') }}</p>

                <STList>
                    <ResourcePermissionRow v-for="category in categories" :key="category.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: category.id, name: category.settings.name, type: PermissionsResourceType.GroupCategories }" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.GroupCategories, patched, categories)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </CategorizedBox>

            <CategorizedBox v-if="enableMemberModule && groups.length" icon="group" :title="$t('%Z7')">
                <STList>
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: $t('%L8'), type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="group in groups" :key="group.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: group.id, name: group.settings.name + ' ('+(group.settings.period?.nameShort ?? '?')+')', type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.Groups, patched, groups)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </CategorizedBox>

            <CategorizedBox v-if="(app !== 'admin' || scope === 'organization') && organization?.meta.packages.useMembers" icon="privacy" :title="$t('%Z9')">
                <p>{{ $t('%ZA') }}</p>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.MemberReadFinancialData" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.MemberWriteFinancialData" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.MemberManageNRN" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <ResourcePermissionRow :role="patched" :resource="{id: '', name: $t('%1eC'), type: PermissionsResourceType.RecordCategories }" :inherited-roles="inheritedRoles" :configurable-access-rights="[]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="{recordCategory, organization: recordCategoryOrganization} in recordCategories" :key="recordCategory.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: recordCategory.id, name: recordCategory.name.toString(), type: PermissionsResourceType.RecordCategories, description: !recordCategoryOrganization ? $t('%CS') : $t('%CT') }" :configurable-access-rights="[]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.RecordCategories, patched, recordCategories.map(r => r.recordCategory))" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </CategorizedBox>

            <CategorizedBox v-if="senders.length" icon="email" :title="$t('%1DK')">
                <p>{{ $t('%1D6') }}</p>

                <STList>
                    <ResourcePermissionRow
                        :role="patched"
                        :inherited-roles="inheritedRoles"
                        :resource="{id: '', name: $t('%1D8'), type: PermissionsResourceType.Senders }"
                        type="resource"
                        @patch:role="addPatch"
                    />
                    <ResourcePermissionRow
                        v-for="sender in senders"
                        :key="sender.id"
                        :role="patched"
                        :inherited-roles="inheritedRoles"
                        :resource="{id: sender.id, name: sender.name || sender.email, description: sender.name ? sender.email : '' , type: PermissionsResourceType.Senders }"
                        type="resource"
                        @patch:role="addPatch"
                    />

                    <ResourcePermissionRow
                        v-for="resource in getUnlistedResources(PermissionsResourceType.Senders, patched, senders)"
                        :key="resource.id"
                        :role="patched"
                        :inherited-roles="inheritedRoles"
                        :resource="resource"
                        type="resource"
                        :unlisted="true"
                        @patch:role="addPatch"
                    />
                    <AccessRightPermissionRow :access-right="AccessRight.ManageEmailTemplates" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />
                </STList>
            </CategorizedBox>

            <CategorizedBox v-if="enableWebshopModule" icon="basket" :title="$t('%1Pd')">
                <p>{{ $t('%Z8') }}</p>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationCreateWebshops" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: $t('%1AW'), type: PermissionsResourceType.Webshops }" :configurable-access-rights="[]" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="webshop in webshops" :key="webshop.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: webshop.id, name: webshop.meta.name, type: PermissionsResourceType.Webshops }" :configurable-access-rights="webshop.hasTickets ? [AccessRight.WebshopScanTickets] : []" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.Webshops, patched, webshops)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.WebshopScanTickets]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </CategorizedBox>

            <CategorizedBox v-if="app !== 'admin' || scope === 'organization'" icon="card" :title="$t('%tx')">
                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationFinanceDirector" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationManagePayments" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />
                </STList>
            </CategorizedBox>
        </template>

        <CategorizedBox v-if="!isNew && !isForResponsibility" icon="user" :title="$t('%ZD')">
            <Spinner v-if="loading" />
            <template v-else>
                <p v-if="filteredAdmins.length === 0" class="info-box">
                    {{ $t('%ZE') }}
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
        </CategorizedBox>
    </CategorizedView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useAppContext } from '#context/appContext.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import CategorizedBox from '#layout/categorized-view/CategorizedBox.vue';
import CategorizedView from '#layout/categorized-view/CategorizedView.vue';
import Spinner from '#Spinner.vue';
import type { Group, GroupCategory, PermissionRoleDetailed, User, WebshopPreview } from '@stamhoofd/structures';
import { AccessRight, getPermissionLevelNumber, getUnlistedResources, maximumPermissionlevel, PermissionLevel, PermissionRoleForResponsibility, PermissionsResourceType, getPermissionLevelName } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
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
        inheritedRoles?: (PermissionRoleDetailed | PermissionRoleForResponsibility)[];
        isNew: boolean;
        saveHandler: (p: AutoEncoderPatchType<PermissionRoleDetailed | PermissionRoleForResponsibility>) => Promise<void>;
        deleteHandler?: (() => Promise<void>) | null;
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
const pop = usePop();
const isForResponsibility = props.role instanceof PermissionRoleForResponsibility;
const canDelete = !props.isNew && !!props.deleteHandler;

const title = computed(() => {
    if (props.role instanceof PermissionRoleForResponsibility) {
        return $t(`%uN`) + ' ' + props.role.name;
    }
    return props.isNew ? $t(`%uO`) : props.role.name;
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

const senders = computed(() => {
    if (organization.value && props.scope !== 'admin') {
        return organization.value?.privateMeta?.emails ?? [];
    }
    return platform.value.privateConfig?.emails ?? [];
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
                message: $t(`%uP`),
                field: 'name',
            });
        }
        await props.saveHandler(patch.value);
        await pop({ force: true });
    } catch (e) {
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

    if (!await CenteredMessage.confirm({
        title: patched.value.name ? $t('%Zmp', { name: patched.value.name }) : $t(`%uQ`),
        confirmText: $t(`%CJ`),
        description: $t('%ZnR'),
        destructive: true,
        availabilityDelay: 2_000,
    })) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    } catch (e) {
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

const isLevelLocked = (level: PermissionLevel) => getPermissionLevelNumber(level) < getPermissionLevelNumber(lockedMinimumLevel.value);

const basePermission = computed({
    get: () => maximumPermissionlevel(lockedMinimumLevel.value, patched.value.level),
    set: (level) => {
        if (isLevelLocked(level)) {
            return;
        }
        addPatch({ level });
    },
});

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

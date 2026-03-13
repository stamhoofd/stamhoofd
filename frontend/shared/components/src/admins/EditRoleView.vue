<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-if="!isForResponsibility" error-fields="name" :error-box="errors.errorBox" :title="$t(`%vC`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%ZF`)">
        </STInputBox>

        <hr><h2>{{ $t('%Yy') }}</h2>
        <p>{{ $t('%Yz') }}</p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" value="None" :disabled="lockedMinimumLevel !== PermissionLevel.None" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%1FW') }}
                </h3>
                <p v-if="basePermission === 'None'" class="style-description-small">
                    {{ $t('%Z0') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" :value="PermissionLevel.Full" :disabled="lockedMinimumLevel !== PermissionLevel.None" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%Z1') }}
                </h3>
                <p v-if="basePermission === PermissionLevel.Full" class="style-description-small">
                    {{ $t('%Z2') }}
                </p>
            </STListItem>
        </STList>

        <template v-if="basePermission !== PermissionLevel.Full">
            <template v-if="app === 'admin' && (scope === null || scope === 'admin')">
                <hr><h2>
                    {{ $t('%Z3') }}
                </h2>

                <p>{{ $t('%Z4') }}</p>

                <STList>
                    <ResourcePermissionRow :role="patched" :resource="{id: '', name: 'Alle verenigingen', type: PermissionsResourceType.OrganizationTags }" :inherited-roles="inheritedRoles" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="tag in tags" :key="tag.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: tag.id, name: tag.name, type: PermissionsResourceType.OrganizationTags }" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.OrganizationTags, patched, tags)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite, AccessRight.OrganizationFinanceDirector, AccessRight.OrganizationEventNotificationReviewer]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </template>

            <template v-if="enableActivities && categories.length">
                <hr><h2>
                    {{ $t('%Z5') }}
                </h2>
                <p>{{ $t('%Z6') }}</p>

                <STList>
                    <ResourcePermissionRow v-for="category in categories" :key="category.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: category.id, name: category.settings.name, type: PermissionsResourceType.GroupCategories }" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.GroupCategories, patched, categories)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </template>

            <div v-if="enableMemberModule && groups.length" class="container">
                <hr><h2>
                    {{ $t('%Z7') }}
                </h2>

                <STList>
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: $t('%L8'), type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="group in groups" :key="group.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: group.id, name: group.settings.name + ' ('+(group.settings.period?.nameShort ?? '?')+')', type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.Groups, patched, groups)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </div>

            <div v-if="senders.length" class="container">
                <hr>
                <h2>
                    {{ $t('%1DK') }}
                </h2>
                <p>{{ $t('%1D6') }}</p>
                <p class="info-box">
                    {{ $t('%1D7') }}
                </p>

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
            </div>

            <div v-if="enableWebshopModule" class="container">
                <hr><h2>{{ $t('%HI') }}</h2>
                <p>{{ $t('%Z8') }}</p>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationCreateWebshops" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: $t('%1AW'), type: PermissionsResourceType.Webshops }" :configurable-access-rights="[]" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="webshop in webshops" :key="webshop.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: webshop.id, name: webshop.meta.name, type: PermissionsResourceType.Webshops }" :configurable-access-rights="webshop.hasTickets ? [AccessRight.WebshopScanTickets] : []" type="resource" @patch:role="addPatch" />
                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.Webshops, patched, webshops)" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.WebshopScanTickets]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </div>

            <div v-if="app !== 'admin' || scope === 'organization'" class="container">
                <hr><h2>
                    {{ $t('%Z9') }}
                </h2>
                <p>{{ $t('%ZA') }}</p>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.MemberReadFinancialData" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.MemberWriteFinancialData" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.MemberManageNRN" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="{recordCategory, organization} in recordCategories" :key="recordCategory.id" :role="patched" :inherited-roles="inheritedRoles" :resource="{id: recordCategory.id, name: recordCategory.name.toString(), type: PermissionsResourceType.RecordCategories, description: !organization ? $t('%CS') : $t('%CT') }" :configurable-access-rights="[]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in getUnlistedResources(PermissionsResourceType.RecordCategories, patched, recordCategories.map(r => r.recordCategory))" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[]" type="resource" :unlisted="true" @patch:role="addPatch" />
                </STList>
            </div>

            <template v-if="app !== 'admin' || scope === 'organization'">
                <hr><h2>{{ $t('%tx') }}</h2>

                <STList>
                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationFinanceDirector" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />

                    <AccessRightPermissionRow :access-right="AccessRight.OrganizationManagePayments" :inherited-roles="inheritedRoles" :role="patched" @patch:role="addPatch" />
                </STList>
            </template>
        </template>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr><h2 v-if="responsibility">
                {{ $t('%ZB') }}
            </h2>
            <h2 v-else>
                {{ $t('%ZC') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>

        <template v-if="!isNew && !responsibility">
            <hr><h2>{{ $t('%ZD') }}</h2>

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
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
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
import SaveView from '#navigation/SaveView.vue';
import Spinner from '#Spinner.vue';
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

    if (!await CenteredMessage.confirm($t(`%uQ`), $t(`%CJ`))) {
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
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
};

defineExpose({
    shouldNavigateAway,
});
</script>

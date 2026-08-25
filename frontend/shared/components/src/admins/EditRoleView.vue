<template>
    <CategorizedView :title="title" :loading="saving" :deleting="deleting" :disabled="!hasChanges" @save="save" v-on="canDelete ? {delete: doDelete} : {}">
        <STErrorsDefault :error-box="errors.errorBox" />

        <CategorizedBox v-if="!isForResponsibility" icon="settings" :title="$t('Algemeen')">
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

            <CategorizedBox v-if="showCategoriesBox" icon="folder" :title="$t('%Z5')">
                <template v-if="organization" #buttons>
                    <button class="button text only-icon-smartphone" type="button" @click="addCategories">
                        <span class="icon add" />
                        <span>{{ $t('Meer toevoegen') }}</span>
                    </button>
                </template>

                <p>{{ $t('%Z6') }}</p>

                <STList>
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: $t('Alle categorieën'), type: PermissionsResourceType.GroupCategories }" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in categoryResources" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.OrganizationCreateGroups]" type="resource" @patch:role="addPatch" />
                </STList>
            </CategorizedBox>

            <CategorizedBox v-if="showGroupsBox" icon="group" :title="$t('%Z7')">
                <template v-if="canAddGroups" #buttons>
                    <button class="button text only-icon-smartphone" type="button" @click="addGroups">
                        <span class="icon add" />
                        <span>{{ $t('Meer toevoegen') }}</span>
                    </button>
                </template>

                <Spinner v-if="loadingGroups" />
                <STList v-else>
                    <ResourcePermissionRow :role="patched" :inherited-roles="inheritedRoles" :resource="{id: '', name: $t('%L8'), type: PermissionsResourceType.Groups }" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" />

                    <ResourcePermissionRow v-for="resource in groupResources" :key="resource.id" :role="patched" :inherited-roles="inheritedRoles" :resource="resource" :configurable-access-rights="[AccessRight.EventWrite]" type="resource" @patch:role="addPatch" />
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
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useAppContext } from '#context/appContext.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import CategorizedBox from '#layout/categorized-view/CategorizedBox.vue';
import CategorizedView from '#layout/categorized-view/CategorizedView.vue';
import Spinner from '#Spinner.vue';
import type { Group, GroupCategory, PermissionRoleDetailed, User, WebshopPreview } from '@stamhoofd/structures';
import { AccessRight, getPermissionLevelName, getPermissionLevelNumber, getUnlistedResources, maximumPermissionlevel, PermissionLevel, PermissionRoleForResponsibility, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { useGetGroupsById } from '@stamhoofd/networking/hooks/useGetGroups';
import type { Ref } from 'vue';
import { computed, ref, shallowRef, watch } from 'vue';
import AccessRightPermissionRow from './components/AccessRightPermissionRow.vue';
import ResourcePermissionRow from './components/ResourcePermissionRow.vue';
import { useAdmins } from './hooks/useAdmins';
import { Toast } from '#overlays/Toast.ts';

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
const pop = usePop();
const present = usePresent();
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
const getGroupsById = useGetGroupsById();
const webshops: Ref<WebshopPreview[]> = computed(() => organization.value?.webshops ?? []);
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

const configuredGroupIds = computed(() => {
    const ids = new Set<string>();

    for (const role of [patched.value, ...props.inheritedRoles]) {
        for (const id of role.resources.get(PermissionsResourceType.Groups)?.keys() ?? []) {
            if (id !== '') {
                ids.add(id);
            }
        }
    }

    return [...ids];
});

const loadingGroups = ref(false);
const resolvedGroups = shallowRef(new Map<string, Group>());

const missingGroupIds = shallowRef(new Set<string>());

watch(configuredGroupIds, async (ids) => {
    const unknownIds = ids.filter(id => !resolvedGroups.value.has(id) && !missingGroupIds.value.has(id));
    if (unknownIds.length === 0) {
        return;
    }

    loadingGroups.value = true;
    try {
        const groups = await getGroupsById(unknownIds);

        const resolved = new Map(resolvedGroups.value);
        for (const group of groups) {
            resolved.set(group.id, group);
        }
        resolvedGroups.value = resolved;

        const missing = new Set(missingGroupIds.value);
        for (const id of unknownIds) {
            if (!resolved.has(id)) {
                missing.add(id);
            }
        }
        missingGroupIds.value = missing;
    } catch (e) {
        Toast.fromError(e).show();
    }
    loadingGroups.value = false;
}, { immediate: true });

function getResourceCoverage(type: PermissionsResourceType) {
    const coverage = ResourcePermissions.create({});

    for (const role of [patched.value, ...props.inheritedRoles]) {
        const all = role.getMergedResourcePermissions(type, '');
        if (all) {
            coverage.add(all);
        }
    }

    return coverage;
}

function resourceAddsAccess(type: PermissionsResourceType, id: string) {
    const coverage = getResourceCoverage(type);

    return [patched.value, ...props.inheritedRoles].some((role) => {
        const resource = role.resources.get(type)?.get(id);
        return !!resource && !resource.isCoveredBy(coverage);
    });
}

const groupResources = computed(() => {
    const rows: { id: string; name: string; type: PermissionsResourceType }[] = [];

    for (const id of configuredGroupIds.value) {
        const group = resolvedGroups.value.get(id);
        if (!group || !resourceAddsAccess(PermissionsResourceType.Groups, id)) {
            continue;
        }

        rows.push({
            id,
            name: group.settings.getNameWithPeriod(),
            type: PermissionsResourceType.Groups,
        });
    }

    rows.sort((a, b) => Sorter.byStringValue(a.name, b.name));
    return rows;
});

// Categories are not resolved: they are rendered with the name cached in the role
const categoryResources = computed(() => {
    const rows = getUnlistedResources(PermissionsResourceType.GroupCategories, patched.value, []);
    const ids = new Set(rows.map(r => r.id));

    // Categories this role only has access to through an inherited role have no entry of their own
    for (const role of props.inheritedRoles) {
        for (const [id, resource] of role.resources.get(PermissionsResourceType.GroupCategories) ?? []) {
            if (id === '' || ids.has(id)) {
                continue;
            }
            ids.add(id);
            rows.push({ id, name: resource.resourceName, type: PermissionsResourceType.GroupCategories });
        }
    }

    rows.sort((a, b) => Sorter.byStringValue(a.name, b.name));
    return rows.filter(resource => resourceAddsAccess(PermissionsResourceType.GroupCategories, resource.id));
});

const canAddGroups = computed(() => !!organization.value && maximumPermissionlevel(
    basePermission.value,
    patched.value.resources.get(PermissionsResourceType.Groups)?.get('')?.level ?? PermissionLevel.None,
) !== PermissionLevel.Full);

async function addGroups() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./EditResourcePermissionsView.vue'), {
                    title: $t('Inschrijvingsgroepen'),
                    role: patched.value,
                    inheritedRoles: props.inheritedRoles,
                    type: PermissionsResourceType.Groups,
                    configurableAccessRights: [AccessRight.EventWrite],
                    saveHandler: addPatch,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addCategories() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./EditResourcePermissionsView.vue'), {
                    title: $t('Inschrijvingscategorieën'),
                    role: patched.value,
                    inheritedRoles: props.inheritedRoles,
                    type: PermissionsResourceType.GroupCategories,
                    configurableAccessRights: [AccessRight.OrganizationCreateGroups],
                    saveHandler: addPatch,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const showGroupsBox = computed(() => organization.value?.meta?.packages.useMembers || !!patched.value.resources.get(PermissionsResourceType.Groups)?.size || configuredGroupIds.value.length > 0);

const showCategoriesBox = computed(() => organization.value?.meta?.packages.useMembers || !!patched.value.resources.get(PermissionsResourceType.GroupCategories)?.size);

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

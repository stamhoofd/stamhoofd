<template>
    <hr>
    <h2 class="style-with-button">
        <div>{{ $t('f5404d3b-f49b-489d-9cb8-05ba668ca0cc') }}</div>
        <div>
            <button type="button" class="button icon add" @click="createAdmin" />
        </div>
    </h2>

    <p>{{ $t('8ed2c90d-f77a-4d9d-aca5-64a76ed50e32') }}</p>
    <p class="info-box">
        {{ $t('a9605085-cd44-454d-9386-3dd30206f3bf') }}
    </p>

    <div v-if="shouldShowSearch" class="input-with-buttons">
        <div>
            <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`01e2b860-7045-4a0c-84ca-2303346d14b2`)">
            </form>
        </div>
    </div>

    <p v-if="sortedAdmins.length === 0" class="info-box">
        {{ $t('ffc7f682-f284-4188-a6fe-fe859bb3f18d') }}
    </p>
    <p v-if="filteredAdmins.length === 0 && sortedAdmins.length > 0" class="info-box">
        {{ $t('34416687-b59a-4637-92a0-fac711d7d231') }}
    </p>

    <STList v-else-if="filteredAdmins.length > 0">
        <STListItem v-for="admin of filteredLimitedAdmins" :key="admin.id" :selectable="true" class="right-stack" @click="editAdmin(admin)">
            <template #left>
                <span v-if="hasFullAccess(admin)" class="icon layered" :v-tooltip="$t('06e0f25f-f601-4359-a95d-b72fd79ecbdd')">
                    <span class="icon user-admin-layer-1" />
                    <span class="icon user-admin-layer-2 yellow" />
                </span>
                <span v-else-if="hasEmptyAccess(admin)" class="icon layered" :v-tooltip="$t('3bb4e938-ca4e-4318-a86d-002ba6035fd0')">
                    <span class="icon user-blocked-layer-1" />
                    <span class="icon user-blocked-layer-2 red" />
                </span>
                <span v-else class="icon user" />
            </template>

            <h2 class="style-title-list">
                <span>{{ admin.name || admin.email }}</span>
            </h2>
            <p class="style-description-small">
                {{ admin.email }}
            </p>
            <p v-if="admin.memberId && sortedMembers.find(m => m.id === admin.memberId)" class="style-description-small">
                {{ $t('61d55c53-d63d-49a1-ac0c-806548eb294a') }}
            </p>
            <p class="style-description-small">
                {{ permissionList(admin) }}
            </p>

            <template #right>
                <span v-if="admin.id === me?.id" class="style-tag">
                    {{ $t('50f1bd97-6ff4-44cb-a44d-45672218b7f8') }}
                </span>
                <span v-else-if="!admin.hasAccount" class="icon email gray" :v-tooltip="$t('0e7858e2-873b-4d49-9b5b-d9b15ea5f97f')" />
                <span><span class="icon gray edit" /></span>
            </template>
        </STListItem>
    </STList>

    <p v-if="shouldShowMoreButton" class="style-button-bar">
        <button type="button" class="button text" @click="showAll = true">
            {{ $t('96140ac1-d193-4ad1-9f33-f5241f00d176', {count: showMoreCount}) }}
        </button>
    </p>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { useOrganization, useUser } from '@stamhoofd/components';
import { PermissionLevel, Permissions, User, UserPermissions, UserWithMembers } from '@stamhoofd/structures';
import { ComponentOptions } from 'vue';
import { computed, ref } from 'vue';
import EditAdminView from './EditAdminView.vue';
import { useAdmins } from './hooks/useAdmins';

const me = useUser();
const organization = useOrganization();
const { sortedAdmins, sortedMembers, reloadPromise, getPermissions, getUnloadedPermissions, reload } = useAdmins();
const MAX_VISIBLE_DEFAULT = 5;
const searchQuery = ref('');
const showAll = ref(false);

const filteredAdmins = computed(() => {
    if (!searchQuery.value) {
        return sortedAdmins.value;
    }
    const query = searchQuery.value.toLowerCase();
    return sortedAdmins.value.filter((admin) => {
        return (admin.name?.toLowerCase().includes(query)) || admin.email.toLowerCase().includes(query);
    });
});

const showMoreCount = computed(() => {
    return filteredAdmins.value.length - MAX_VISIBLE_DEFAULT;
});

const shouldShowSearch = computed(() => {
    return sortedAdmins.value.length - MAX_VISIBLE_DEFAULT >= 2;
});

const shouldShowMoreButton = computed(() => {
    return !showAll.value && showMoreCount.value >= 2;
});

const filteredLimitedAdmins = computed(() => {
    if (!shouldShowMoreButton.value) {
        return filteredAdmins.value;
    }
    return filteredAdmins.value.slice(0, MAX_VISIBLE_DEFAULT);
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

enum Routes {
    CreateAdmin = 'createAdmin',
    EditAdmin = 'editAdmin',
}

defineRoutes([
    {
        url: 'nieuw',
        name: Routes.CreateAdmin,
        component: EditAdminView as ComponentOptions,
        present: 'popup',
        paramsToProps: () => {
            const p = UserPermissions.create({});
            if (!organization.value) {
                p.globalPermissions = Permissions.create({ level: PermissionLevel.None });
            }
            else {
                p.organizationPermissions.set(organization.value.id, Permissions.create({ level: PermissionLevel.None }));
            }

            const user = UserWithMembers.create({
                email: '',
                organizationId: organization.value?.id ?? null,
                permissions: p,
            });

            return {
                user,
                isNew: true,
            };
        },
    },
    {
        url: '@userId',
        name: Routes.EditAdmin,
        component: EditAdminView as ComponentOptions,
        present: 'popup',
        params: {
            userId: String,
        },
        paramsToProps: async (params: { userId: string }) => {
            await reloadPromise();
            const user = sortedAdmins.value.find(u => u.id === params.userId);
            if (!user) {
                throw new Error('User not found');
            }
            return {
                user,
                isNew: false,
            };
        },
        propsToParams(props) {
            if (!('user' in props)) {
                throw new Error('Missing user');
            }
            return {
                params: {
                    userId: (props.user as User).id,
                },
            };
        },
    },
]);

const $navigate = useNavigate();

const createAdmin = async () => {
    await $navigate(Routes.CreateAdmin);
};

const editAdmin = async (user: User) => {
    await $navigate(Routes.EditAdmin, { properties: { user } });
};

const hasFullAccess = (user: User) => getPermissions(user)?.hasFullAccess() ?? false;
const hasEmptyAccess = (user: User) => getPermissions(user)?.isEmpty ?? true;

const permissionList = (user: User) => {
    const list: string[] = [];
    const permissions = getPermissions(user);
    if (!permissions) {
        return $t(`09004cd9-3fc8-4ba6-b758-5fe2348b4982`);
    }

    if (permissions.hasFullAccess()) {
        list.push($t(`6e948886-0b41-49e8-80be-0e2e3c795359`));
    }

    for (const role of getUnloadedPermissions(user)?.roles ?? []) {
        list.push(role.name);
    }

    if (list.length === 0) {
        return $t(`09004cd9-3fc8-4ba6-b758-5fe2348b4982`);
    }
    return list.join(', ');
};
</script>

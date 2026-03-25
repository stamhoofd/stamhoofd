<template>
    <hr>
    <h2 class="style-with-button">
        <div>{{ $t('%Yf') }}</div>
        <div>
            <button type="button" class="button icon add" @click="createAdmin" />
        </div>
    </h2>

    <p>{{ $t('%Yg') }}</p>
    <p class="info-box">
        {{ $t('%Bx') }}
    </p>

    <div v-if="shouldShowSearch" class="input-with-buttons">
        <div>
            <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
            </form>
        </div>
    </div>

    <p v-if="sortedAdmins.length === 0" class="info-box">
        {{ $t('%Yh') }}
    </p>
    <p v-if="filteredAdmins.length === 0 && sortedAdmins.length > 0" class="info-box">
        {{ $t('%1AX') }}
    </p>

    <STList v-else-if="filteredAdmins.length > 0">
        <STListItem v-for="admin of filteredLimitedAdmins" :key="admin.id" :selectable="true" class="right-stack" @click="editAdmin(admin)">
            <template #left>
                <span v-if="hasFullAccess(admin)" class="icon layered" :v-tooltip="$t('%Yb')">
                    <span class="icon user-admin-layer-1" />
                    <span class="icon user-admin-layer-2 yellow" />
                </span>
                <span v-else-if="hasEmptyAccess(admin)" class="icon layered" :v-tooltip="$t('%Yc')">
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
                {{ $t('%Bz') }}
            </p>
            <p class="style-description-small">
                {{ permissionList(admin) }}
            </p>

            <template #right>
                <span v-if="admin.id === me?.id" class="style-tag">
                    {{ $t('%Yd') }}
                </span>
                <span v-else-if="!admin.hasAccount" class="icon email gray" :v-tooltip="$t('%Ye')" />
                <span><span class="icon gray edit" /></span>
            </template>
        </STListItem>
    </STList>

    <p v-if="shouldShowMoreButton" class="style-button-bar">
        <button type="button" class="button text" @click="showAll = true">
            {{ $t('%1AY', {count: showMoreCount}) }}
        </button>
    </p>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUser } from '#hooks/useUser.ts';
import type { User} from '@stamhoofd/structures';
import { PermissionLevel, Permissions, UserPermissions, UserWithMembers } from '@stamhoofd/structures';
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
        component: EditAdminView,
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
        component: EditAdminView,
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
        return $t(`%uF`);
    }

    if (permissions.hasFullAccess()) {
        list.push($t(`%uG`));
    }

    for (const role of getUnloadedPermissions(user)?.roles ?? []) {
        list.push(role.name);
    }

    if (list.length === 0) {
        return $t(`%uF`);
    }
    return list.join(', ');
};
</script>

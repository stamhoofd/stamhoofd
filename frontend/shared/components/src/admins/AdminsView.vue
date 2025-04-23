<template>
    <LoadingViewTransition>
        <div v-if="!loading" class="st-view background">
            <STNavigationBar :title="$t(`Beheerders`)" />

            <main class="center">
                <h1>{{ $t('05dff2a6-72fa-4054-ab7f-8e04dc7c7ed9') }}</h1>
                <p>{{ $t('ac3b2a14-e029-404c-9fe1-2aab4279a3ac') }}</p>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Responsibilities)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/admin-role.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('104d3831-38fb-4e1e-89f2-cbd5d538faa3') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('dcfeea1e-7841-4dbd-a187-84aed37f0790') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('8f75871d-17d9-49b1-aaf2-c7054e058372') }}</h2>
                <p>{{ $t('ee16437e-ecc8-42c5-91ef-e2546c71ba12') }}</p>

                <p v-if="sortedMembers.length === 0" class="info-box">
                    {{ $t('4d9168af-27ed-438e-acd9-756474dd6f5e') }}
                </p>
                <STList v-else>
                    <STListItem v-for="member in sortedMembers" :key="member.id" :selectable="true" class="right-stack" @click="editMember(member)">
                        <template #left>
                            <span v-if="memberHasFullAccess(member)" class="icon layered" :v-tooltip="$t('06e0f25f-f601-4359-a95d-b72fd79ecbdd')">
                                <span class="icon user-admin-layer-1" />
                                <span class="icon user-admin-layer-2 yellow" />
                            </span>
                            <span v-else-if="memberHasNoRoles(member)" class="icon layered" :v-tooltip="$t('3bb4e938-ca4e-4318-a86d-002ba6035fd0')">
                                <span class="icon user-blocked-layer-1" />
                                <span class="icon user-blocked-layer-2 red" />
                            </span>
                            <span v-else class="icon user" />
                        </template>

                        <h2 class="style-title-list">
                            <span>{{ member.patchedMember.name }}</span>
                        </h2>
                        <p class="style-description-small">
                            {{ member.patchedMember.users.filter(u => u.memberId === member.id).map(u => u.email).join(', ') }}
                        </p>
                        <p class="style-description-small">
                            {{ Formatter.joinLast(member.getResponsibilities({organization}).map(l => l.getName(member, false)), ', ', ' en ') }}
                        </p>

                        <template #right>
                            <span v-if="member.id === me?.memberId" class="style-tag">
                                {{ $t('50f1bd97-6ff4-44cb-a44d-45672218b7f8') }}
                            </span>
                            <span v-else-if="!member.patchedMember.users.find(u => u.hasAccount)" class="icon email gray" :v-tooltip="$t('0e7858e2-873b-4d49-9b5b-d9b15ea5f97f')" />
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>
                </STList>

                <hr><h2 class="style-with-button">
                    <div>{{ $t('f5404d3b-f49b-489d-9cb8-05ba668ca0cc') }}</div>
                    <div>
                        <button type="button" class="button icon add" @click="createAdmin" />
                    </div>
                </h2>

                <p>{{ $t('8ed2c90d-f77a-4d9d-aca5-64a76ed50e32') }}</p>
                <p class="info-box">
                    {{ $t('a9605085-cd44-454d-9386-3dd30206f3bf') }}
                </p>

                <p v-if="sortedAdmins.length === 0" class="info-box">
                    {{ $t('ffc7f682-f284-4188-a6fe-fe859bb3f18d') }}
                </p>

                <STList v-else>
                    <STListItem v-for="admin of sortedAdmins" :key="admin.id" :selectable="true" class="right-stack" @click="editAdmin(admin)">
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
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { EditResponsibilitiesView, LoadingViewTransition, useOrganization, useUser } from '@stamhoofd/components';
import { PermissionLevel, Permissions, PlatformMember, User, UserPermissions, UserWithMembers } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions } from 'vue';
import { useMemberActions } from '../members/classes/MemberActionBuilder';
import EditAdminView from './EditAdminView.vue';
import RolesView from './RolesView.vue';
import { useAdmins } from './hooks/useAdmins';

const me = useUser();
const organization = useOrganization();
const { sortedAdmins, sortedMembers, loading, reloadPromise, getPermissions, getUnloadedPermissions } = useAdmins();

enum Routes {
    Roles = 'rollen',
    Responsibilities = 'functies',
    CreateAdmin = 'createAdmin',
    EditAdmin = 'editAdmin',
}

defineRoutes([
    {
        url: Routes.Roles,
        name: 'roles',
        component: RolesView as ComponentOptions,
        present: 'popup',
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: EditResponsibilitiesView as ComponentOptions,
    },
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

const memberHasFullAccess = (member: PlatformMember) => !!member.patchedMember.users.find(u => u.memberId === member.id && hasFullAccess(u));
const memberHasNoRoles = (member: PlatformMember) => !!member.patchedMember.users.find(u => u.memberId === member.id && hasEmptyAccess(u));

const permissionList = (user: User) => {
    const list: string[] = [];
    const permissions = getPermissions(user);
    if (!permissions) {
        return $t(`Geen toegangsrechten`);
    }

    if (permissions.hasFullAccess()) {
        list.push($t(`Hoofdbeheerders`));
    }

    for (const role of getUnloadedPermissions(user)?.roles ?? []) {
        list.push(role.name);
    }

    if (list.length === 0) {
        return $t(`Geen toegangsrechten`);
    }
    return list.join(', ');
};

const actionBuilder = useMemberActions();

async function editMember(member: PlatformMember) {
    await actionBuilder().showMember(member);
}
</script>

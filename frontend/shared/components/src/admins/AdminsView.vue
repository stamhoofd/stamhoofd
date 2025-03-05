<template>
    <LoadingViewTransition>
        <div v-if="!loading" class="st-view background">
            <STNavigationBar :title="$t(`Beheerders`)"/>

            <main class="center">
                <h1>{{ $t('efd3248e-bb26-4d50-8dd9-35bac8f44656') }}</h1>
                <p>{{ $t('ac3b2a14-e029-404c-9fe1-2aab4279a3ac') }}</p>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Responsibilities)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/admin-role.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('f042f8a1-99f5-4547-bf98-c4c299749c8f') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('fdfb8b86-058f-47fb-8445-5cda6dc4e98e') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('07b418cc-3fca-4654-8dac-091de6997d9b') }}</h2>
                <p>{{ $t('5ebd5d1d-1d8d-4026-85d2-573552999114') }}</p>

                <p v-if="sortedMembers.length === 0" class="info-box">
                    {{ $t('91f4529c-85e9-4318-821e-58593f5a0239') }}
                </p>
                <STList v-else>
                    <STListItem v-for="member in sortedMembers" :key="member.id" :selectable="true" class="right-stack" @click="editMember(member)">
                        <template #left>
                            <span v-if="memberHasFullAccess(member)" v-tooltip="'Hoofdbeheerder'" class="icon layered">
                                <span class="icon user-admin-layer-1"/>
                                <span class="icon user-admin-layer-2 yellow"/>
                            </span>
                            <span v-else-if="memberHasNoRoles(member)" v-tooltip="'Heeft geen rol'" class="icon layered">
                                <span class="icon user-blocked-layer-1"/>
                                <span class="icon user-blocked-layer-2 red"/>
                            </span>
                            <span v-else class="icon user"/>
                        </template>

                        <h2 class="style-title-list">
                            <span>{{ member.patchedMember.name }}</span>
                        </h2>
                        <p class="style-description-small">
                            {{ member.patchedMember.users.filter(u => u.memberId === member.id).map(u => u.email).join(', ') }}
                        </p>
                        <p class="style-description-small">
                            {{ Formatter.joinLast(member.getResponsibilities(organization).map(l => l.getName(member, false)), ', ', ' en ') }}
                        </p>

                        <template #right>
                            <span v-if="member.id === me?.memberId" class="style-tag">
                                {{ $t('5af9c03d-6e46-4252-8ca1-9cec20e6a3b5') }}
                            </span>
                            <span v-else-if="!member.patchedMember.users.find(u => u.hasAccount)" v-tooltip="'Uitnodiging nog niet geaccepteerd'" class="icon email gray"/>
                            <span><span class="icon gray edit"/></span>
                        </template>
                    </STListItem>
                </STList>

                <hr><h2 class="style-with-button">
                    <div>{{ $t('da9d5994-ced3-44f0-9dcf-b0d024c5d584') }}</div>
                    <div>
                        <button type="button" class="button icon add" @click="createAdmin"/>
                    </div>
                </h2>

                <p>{{ $t('a4a48823-b500-409a-a834-345c0bbf902c') }}</p>
                <p class="info-box">
                    {{ $t('a9605085-cd44-454d-9386-3dd30206f3bf') }}
                </p>

                <p v-if="sortedAdmins.length === 0" class="info-box">
                    {{ $t('61049fec-9a3c-4cb0-8c53-19a45ec937f7') }}
                </p>

                <STList v-else>
                    <STListItem v-for="admin of sortedAdmins" :key="admin.id" :selectable="true" class="right-stack" @click="editAdmin(admin)">
                        <template #left>
                            <span v-if="hasFullAccess(admin)" v-tooltip="'Hoofdbeheerder'" class="icon layered">
                                <span class="icon user-admin-layer-1"/>
                                <span class="icon user-admin-layer-2 yellow"/>
                            </span>
                            <span v-else-if="hasEmptyAccess(admin)" v-tooltip="'Heeft geen rol'" class="icon layered">
                                <span class="icon user-blocked-layer-1"/>
                                <span class="icon user-blocked-layer-2 red"/>
                            </span>
                            <span v-else class="icon user"/>
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
                                {{ $t('5af9c03d-6e46-4252-8ca1-9cec20e6a3b5') }}
                            </span>
                            <span v-else-if="!admin.hasAccount" v-tooltip="'Uitnodiging nog niet geaccepteerd'" class="icon email gray"/>
                            <span><span class="icon gray edit"/></span>
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
        return 'Geen toegangsrechten';
    }

    if (permissions.hasFullAccess()) {
        list.push('Hoofdbeheerders');
    }

    for (const role of getUnloadedPermissions(user)?.roles ?? []) {
        list.push(role.name);
    }

    if (list.length === 0) {
        return 'Geen toegangsrechten';
    }
    return list.join(', ');
};

const actionBuilder = useMemberActions();

async function editMember(member: PlatformMember) {
    await actionBuilder().showMember(member);
}
</script>

<template>
    <LoadingView v-if="loading" />
    <div v-else class="st-view background">
        <STNavigationBar title="Beheerders">
            <template #right><button class="button text only-icon-smartphone" aria-label="Nieuwe beheerder" type="button" @click="createAdmin">
                <span class="icon add" />
                <span>Beheerder</span>
            </button></template>
        </STNavigationBar>

    
        <main class="center">
            <h1>Beheerders</h1>
            <p>Voeg hier beheerders toe en regel wat ze kunnen doen in Stamhoofd door rollen toe te kennen. Maak zelf nieuwe rollen aan en stel de rechten in per rol.</p>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="createAdmin">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/account-add.svg"></template>
                    <h2 class="style-title-list">
                        Nieuwe beheerder
                    </h2>
                    <p class="style-description">
                        Nodig iemand uit om beheerder te worden.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="editRoles(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/admin-role.svg"></template>
                    <h2 class="style-title-list">
                        Rollen beheren
                    </h2>
                    <p class="style-description">
                        Maak rollen die je aan beheerders kan toekennen.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>Alle beheerders</h2>
            <STList>
                <STListItem v-for="admin in sortedAdmins" :key="admin.id" :selectable="true" class="right-stack" @click="editAdmin(admin)">
                    <template #left>
                        <span v-if="hasFullAccess(admin)" v-tooltip="'Hoofdbeheerder'" class="icon layered">
                            <span class="icon user-admin-layer-1" />
                            <span class="icon user-admin-layer-2 yellow" />
                        </span>
                        <span v-else-if="hasNoRoles(admin)" v-tooltip="'Heeft geen rol'" class="icon layered">
                            <span class="icon user-blocked-layer-1" />
                            <span class="icon user-blocked-layer-2 red" />
                        </span>
                        <span v-else class="icon user" />
                    </template>

                    <h2 class="style-title-list">
                        <span>{{ admin.firstName }} {{ admin.lastName }}</span>
                    </h2>
                    <p class="style-description-small">
                        {{ admin.email }}
                    </p>
                    <p class="style-description-small">
                        {{ permissionList(admin) }}
                    </p>

                    <template #right>
                        <span v-if="admin.id === me?.id" class="style-tag">
                            Ik
                        </span>
                        <span v-else-if="!admin.hasAccount" v-tooltip="'Uitnodiging nog niet geaccepteerd'" class="icon email gray" />
                        <span><span class="icon gray edit" /></span>
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { LoadingView, useOrganization, usePlatform, useUser } from '@stamhoofd/components';
import { PermissionLevel, Permissions, User, UserPermissions } from '@stamhoofd/structures';
import { ComponentOptions } from 'vue';
import EditAdminView from './EditAdminView.vue';
import RolesView from './RolesView.vue';
import { useAdmins } from './hooks/useAdmins';

const me = useUser();
const organization = useOrganization()
const {sortedAdmins, loading, promise: loadPromise, getPermissions} = useAdmins()

defineRoutes([
    {
        url: 'rollen',
        name: 'roles',
        component: RolesView as ComponentOptions,
        present: 'popup'
    },
    {
        url: 'nieuw',
        name: 'createAdmin',
        component: EditAdminView as ComponentOptions,
        present: 'popup',
        paramsToProps: () => {
            const p = UserPermissions.create({})
            if (!organization.value) {
                p.globalPermissions = Permissions.create({level: PermissionLevel.None})
            } else {
                p.organizationPermissions.set(organization.value.id, Permissions.create({level: PermissionLevel.None}))
            }
            
            const user = User.create({
                email: '',
                organizationId: organization.value?.id ?? null,
                permissions: p
            })

            return {
                user,
                isNew: true
            }
        }
    },
    {
        url: '@userId',
        name: 'editAdmin',
        component: EditAdminView as ComponentOptions,
        present: 'popup',
        params: {
            userId: String
        },
        paramsToProps: async (params: {userId: string}) => {
            await loadPromise;
            const user = sortedAdmins.value.find(u => u.id === params.userId)
            if (!user) {
                throw new Error('User not found')
            }
            return {
                user,
                isNew: false
            }
        },
        propsToParams(props) {
            if (!("user" in props)) {
                throw new Error('Missing user')
            }
            return {
                params: {
                    userId: (props.user as User).id
                }
            }
        }
    }
]);

const $navigate = useNavigate();

const createAdmin = async () => {
    await $navigate('createAdmin')
}

const editAdmin = async (user: User) => {
    await $navigate('editAdmin', { properties: {user} })
}

const editRoles = () => {
    $navigate('roles')
}

const hasFullAccess = (user: User) => getPermissions(user)?.hasFullAccess() ?? false
const hasNoRoles = (user: User) => (getPermissions(user)?.roles.length ?? 0) === 0
const permissionList = (user: User) => {
    const list: string[] = []
    const permissions = getPermissions(user)
    if (!permissions) {
        return 'Geen toegangsrechten'
    }

    if (permissions.hasFullAccess()) {
        list.push("Hoofdbeheerders")
    }

    for (const role of permissions.roles) {
        list.push(role.name)
    }

    if (list.length === 0) {
        return 'Geen toegangsrechten'
    }
    return list.join(", ")
}
</script>
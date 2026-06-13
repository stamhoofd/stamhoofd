<template>
    <LoadingViewTransition>
        <div v-if="!loading" class="st-view background">
            <STNavigationBar :title="$t(`%K5`)">
                <template #right>
                    <button class="button icon add" aria-label="Nieuwe beheerder" type="button" @click="createUser" />
                </template>
            </STNavigationBar>

            <main>
                <h1>{{ $t('%K0') }}</h1>
                <p>{{ $t('%5P') }}</p>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="createUser">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/laptop-add.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%Jy') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%K1') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('%K2') }}</h2>

                <p v-if="apiUsers.length === 0" class="info-box">
                    {{ $t('%K3') }}
                </p>
                <STList v-else>
                    <STListItem v-for="user in apiUsers" :key="user.id" :selectable="true" class="right-stack" @click="editUser(user)">
                        <template #left>
                            <span class="icon key" />
                        </template>

                        <h2 class="style-title-list">
                            <span>{{ user.name || $t('%CL') }}</span>
                        </h2>
                        <p class="style-description-small">
                            {{ permissionList(user) }}
                        </p>
                        <p class="style-description-small">
                            {{ $t('%1JJ') }} {{ formatDate(user.createdAt) }}
                        </p>
                        <p v-if="user.expiresAt" class="style-description-small">
                            {{ $t('%K4') }} {{ formatDate(user.expiresAt) }}
                        </p>

                        <template #right>
                            <span><span class="icon gray edit" /></span>
                        </template>
                    </STListItem>
                </STList>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { ApiUser, PermissionLevel, Permissions, UserPermissions } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

import ApiUserView from './ApiUserView.vue';

const context = useContext();
const organization = useRequiredOrganization();
const present = usePresent();
const loading = ref(true);
const apiUsers = shallowRef<ApiUser[]>([]);
const requestOwner = {};
const formatDate = Formatter.date.bind(Formatter);

onMounted(() => {
    load().catch(console.error);
});
onBeforeUnmount(() => Request.cancelAll(requestOwner));

async function load() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/api-keys',
            decoder: new ArrayDecoder(ApiUser as Decoder<ApiUser>),
            owner: requestOwner,
        });
        response.data.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
        apiUsers.value = response.data;
    } catch (e) {
        if (!Request.isNetworkError(e)) {
            Toast.fromError(e).show();
        }
    }
    loading.value = false;
}

function permissionList(user: ApiUser) {
    const list: string[] = [];
    const permissions = user.permissions?.organizationPermissions.get(organization.value.id);
    if (permissions?.level === PermissionLevel.Full) {
        list.push($t(`%uG`));
    }

    for (const role of permissions?.roles ?? []) {
        list.push(role.name);
    }
    return list.join(', ');
}

async function createUser() {
    const permissions = UserPermissions.create({});
    permissions.organizationPermissions.set(organization.value.id, Permissions.create({ level: PermissionLevel.Full }));
    await present(new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(ApiUserView, {
            user: ApiUser.create({
                organizationId: organization.value.id,
                permissions,
            }),
            isNew: true,
            callback: () => load().catch(console.error),
        }),
    }).setDisplayStyle('popup'));
}

async function editUser(user: ApiUser) {
    await present(new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(ApiUserView, {
            user,
            isNew: false,
            callback: () => load().catch(console.error),
        }),
    }).setDisplayStyle('popup'));
}
</script>

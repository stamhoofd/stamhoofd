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

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import BackButton from '@stamhoofd/components/navigation/BackButton.vue';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import TooltipDirective from '@stamhoofd/components/directives/Tooltip.ts';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import { ApiUser, PermissionLevel, Permissions, User, UserPermissions } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import ApiUserView from './ApiUserView.vue';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingViewTransition,
        BackButton,
    },
    directives: {
        tooltip: TooltipDirective,
    },
})
export default class ApiUsersView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager; // needed to make session reactive
    loading = true;
    apiUsers: ApiUser[] = [];

    mounted() {
        this.load().catch((e) => {
            console.error(e);
        });
    }

    async load() {
        try {
            const response = await this.$context.authenticatedServer.request({
                method: 'GET',
                path: '/api-keys',
                decoder: new ArrayDecoder(ApiUser as Decoder<ApiUser>),
                owner: this,
            });
            response.data.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
            this.apiUsers = response.data;
        }
        catch (e) {
            if (!Request.isNetworkError(e)) {
                Toast.fromError(e).show();
            }
        }
        this.loading = false;
    }

    get organization() {
        return this.$organization;
    }

    permissionList(user: ApiUser) {
        const list: string[] = [];
        const o = user.permissions?.organizationPermissions.get(this.organization.id);
        if (o?.level === PermissionLevel.Full) {
            list.push($t(`%uG`));
        }

        for (const role of o?.roles ?? []) {
            list.push(role.name);
        }
        return list.join(', ');
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? [];
    }

    createUser() {
        const p = UserPermissions.create({});
        p.organizationPermissions.set(this.organization.id, Permissions.create({ level: PermissionLevel.Full }));
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ApiUserView, {
                user: ApiUser.create({
                    organizationId: this.organization.id,
                    permissions: p,
                }),
                isNew: true,
                callback: () => {
                    this.load().catch((e) => {
                        console.error(e);
                    });
                },
            }),
        }).setDisplayStyle('popup'));
    }

    editUser(admin: ApiUser) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ApiUserView, {
                user: admin,
                isNew: false,
                callback: () => {
                    this.load().catch((e) => {
                        console.error(e);
                    });
                },
            }),
        }).setDisplayStyle('popup'));
    }
}

</script>

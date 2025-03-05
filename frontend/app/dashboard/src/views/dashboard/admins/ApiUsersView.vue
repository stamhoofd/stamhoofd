<template>
    <LoadingViewTransition>
        <div v-if="!loading" class="st-view background">
            <STNavigationBar :title="$t(`efd3248e-bb26-4d50-8dd9-35bac8f44656`)">
                <template #right>
                    <button class="button navigation icon add" aria-label="Nieuwe beheerder" type="button" @click="createUser"/>
                </template>
            </STNavigationBar>

            <main>
                <h1>{{ $t('b97d8955-5ce5-435f-ba7d-f3899afb953f') }}</h1>
                <p>{{ $t('4d995169-f792-40f5-addf-60d8aed00362') }}</p>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="createUser">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/laptop-add.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('6807ac16-2f7f-4738-831f-ead40eb9b704') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('e92947ee-19a0-44d6-88a0-6acf384ba83e') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('bf0ea1d3-ad5e-4a6b-af19-91fd4850c08c') }}</h2>

                <p v-if="apiUsers.length === 0" class="info-box">
                    {{ $t('a77057db-2981-47ad-8403-ca294b0cf44c') }}
                </p>
                <STList v-else>
                    <STListItem v-for="user in apiUsers" :key="user.id" :selectable="true" class="right-stack" @click="editUser(user)">
                        <template #left>
                            <span class="icon key"/>
                        </template>

                        <h2 class="style-title-list">
                            <span>{{ user.name }}</span>
                        </h2>
                        <p class="style-description-small">
                            {{ permissionList(user) }}
                        </p>
                        <p class="style-description-small">
                            {{ $t('25981b4f-4483-47f9-8c3a-ac5e7bdc1a69') }} {{ formatDate(user.createdAt) }}
                        </p>
                        <p class="style-description-small">
                            {{ $t('cce09c3a-eaea-4183-89db-7e519c13d2f8') }} {{ formatDate(user.expiresAt) }}
                        </p>

                        <template #right>
                            <span><span class="icon gray edit"/></span>
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
import { BackButton, Checkbox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective, LoadingViewTransition } from '@stamhoofd/components';
import { SessionManager } from '@stamhoofd/networking';
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

    permissionList(user: User) {
        const list: string[] = [];
        const o = user.permissions?.forOrganization(this.organization);
        if (o?.hasFullAccess()) {
            list.push('Hoofdbeheerders');
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

<template>
    <LoadingViewTransition>
        <div v-if="!loading" class="st-view background">
            <STNavigationBar :title="$t(`05dff2a6-72fa-4054-ab7f-8e04dc7c7ed9`)">
                <template #right>
                    <button class="button navigation icon add" aria-label="Nieuwe beheerder" type="button" @click="createUser" />
                </template>
            </STNavigationBar>

            <main>
                <h1>{{ $t('a5b3b5e6-70c0-4818-9548-01f810477cd2') }}</h1>
                <p>{{ $t('4d995169-f792-40f5-addf-60d8aed00362') }}</p>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="createUser">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/laptop-add.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('e5c619de-2d3d-470f-857b-185912b9784e') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('af0a4e82-1872-4c61-9b80-fbfb52ef1278') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('cb3e6e8b-ebff-4021-9234-74e33ae44858') }}</h2>

                <p v-if="apiUsers.length === 0" class="info-box">
                    {{ $t('c2dad537-31e8-412c-8002-c7210d6f33d0') }}
                </p>
                <STList v-else>
                    <STListItem v-for="user in apiUsers" :key="user.id" :selectable="true" class="right-stack" @click="editUser(user)">
                        <template #left>
                            <span class="icon key" />
                        </template>

                        <h2 class="style-title-list">
                            <span>{{ user.name || $t('0076d594-efee-4ec7-a00a-073a4c689a38') }}</span>
                        </h2>
                        <p class="style-description-small">
                            {{ permissionList(user) }}
                        </p>
                        <p class="style-description-small">
                            {{ $t('b6391640-1e01-47f9-913d-360fb0903b75') }} {{ formatDate(user.createdAt) }}
                        </p>
                        <p v-if="user.expiresAt" class="style-description-small">
                            {{ $t('52ab641f-5864-4fac-8c52-0df00ad7e0a9') }} {{ formatDate(user.expiresAt) }}
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
import { BackButton, Checkbox, LoadingViewTransition, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective } from '@stamhoofd/components';
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

    permissionList(user: ApiUser) {
        const list: string[] = [];
        const o = user.permissions?.organizationPermissions.get(this.organization.id);
        if (o?.level === PermissionLevel.Full) {
            list.push($t(`feff031d-9953-443f-ae78-eee68cec0fb7`));
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

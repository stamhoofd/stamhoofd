<template>
    <LoadingView v-if="loading" />
    <div v-else class="st-view background">
        <STNavigationBar title="Beheerders" :dismiss="canDismiss" :pop="canPop">
            <button slot="right" class="button navigation icon add" aria-label="Nieuwe beheerder" type="button" @click="createUser" />
        </STNavigationBar>

    
        <main>
            <h1>API-keys</h1>
            <p>Maak API-keys aan om toegang te krijgen tot de Stamhoofd API.</p>


            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="createUser">
                    <img slot="left" src="@stamhoofd/assets/images/illustrations/laptop-add.svg">
                    <h2 class="style-title-list">
                        Nieuwe API-key
                    </h2>
                    <p class="style-description">
                        Maak een nieuwe key aan.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>Alle API-keys</h2>

            <p v-if="apiUsers.length == 0" class="info-box">
                Nog geen API-keys aangemaakt
            </p>
            <STList v-else>
                <STListItem v-for="user in apiUsers" :key="user.id" :selectable="true" class="right-stack" @click="editUser(user)">
                    <template #left>
                        <span class="icon key" />
                    </template>

                    <h2 class="style-title-list">
                        <span>{{ user.name }}</span>
                    </h2>
                    <p class="style-description-small">
                        {{ permissionList(user) }}
                    </p>
                    <p class="style-description-small">
                        Aangemaakt op {{ formatDate(user.createdAt) }}
                    </p>
                    <p class="style-description-small">
                        Geldig tot {{ formatDate(user.expiresAt) }}
                    </p>

                    <template #right>
                        <span><span class="icon gray edit" /></span>
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>


<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingView, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { ApiUser, PermissionLevel, Permissions, User } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";


import AdminView from './AdminView.vue';
import ApiUserView from './ApiUserView.vue';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        BackButton
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class ApiUsersView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    loading = true
    apiUsers: ApiUser[] = []

    mounted() {
        this.load().catch(e => {
            console.error(e)
        })

        UrlHelper.setUrl("/settings/api-keys")
        document.title = "Stamhoofd - API-keys"
        UrlHelper.shared.clear()
    }

    async load() {
        try {
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/api-keys",
                decoder: new ArrayDecoder(ApiUser as Decoder<ApiUser>),
                owner: this
            })
            response.data.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
            this.apiUsers = response.data
        } catch (e) {
            if (!Request.isNetworkError(e)) {
                Toast.fromError(e).show()
            }
        }
        this.loading = false
    }

    get organization() {
        return this.$organization
    }

    formatDate(date: Date) {
        return Formatter.date(date, true)
    }

    permissionList(user: User) {
        const list: string[] = []
        if (user.permissions?.hasFullAccess(this.organization.privateMeta?.roles ?? [])) {
            list.push("Hoofdbeheerders")
        }

        for (const role of user.permissions?.roles ?? []) {
            list.push(role.name)
        }
        return list.join(", ")
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }

    createUser() {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(ApiUserView, {
                user: ApiUser.create({
                    permissions: Permissions.create({ level: PermissionLevel.Full })
                }),
                isNew: true,
                callback: () => {
                    this.load().catch(e => {
                        console.error(e)
                    })
                }
            }) 
        }).setDisplayStyle("popup"))
    }

    editUser(admin: ApiUser) {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(ApiUserView, { 
                user: admin,
                isNew: false,
                callback: () => {
                    this.load().catch(e => {
                        console.error(e)
                    })
                }
            })
        }).setDisplayStyle("popup"))
    }
}

</script>
<template>
    <div class="st-view">
        <STNavigationBar title="Beheerders" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1>
                <span>Beheerders</span>
            </h1>

            <STList>
                <STListItem v-for="admin in sortedAdmins" :key="admin.id" :selectable="true" class="right-stack" @click="editAdmin(admin)">
                    <template #left>
                        <span v-if="hasFullAccess(admin)" v-tooltip="'Hoofdbeheerder'" class="icon layered">
                            <span class="icon user-admin-layer-1" />
                            <span class="icon user-admin-layer-2 yellow" />
                        </span>
                        <span v-else-if="hasNoRoles(admin)" v-tooltip="'Heeft geen rol'" class="icon layered">
                            <span class="icon user-blocked-layer-1" />
                            <span class="icon user-blocked-layer-2 error" />
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
                        <span v-if="!admin.hasAccount" v-tooltip="'Uitnodiging nog niet geaccepteerd'" class="icon email gray" />
                        <span><span class="icon gray edit" /></span>
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingView, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { NewUser, OrganizationSummary, PermissionLevel, Permissions, User } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import EditUserView from "./EditUserView.vue";


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        LoadingView,
        STInputBox
    },
    filters: {
        price: Formatter.price,
        dateTime: Formatter.dateTime.bind(Formatter)
    },
    directives: { Tooltip },
})
export default class OrganizationAdminsView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        organization!: OrganizationSummary

    hasFullAccess(user: User) {
        return user.permissions?.hasFullAccess(this.organization?.privateMeta?.roles ?? []) ?? false
    }

    hasNoRoles(user: User) {
        return !user.permissions?.hasReadAccess(this.organization?.privateMeta?.roles ?? []) && user.permissions?.roles.length == 0
    }

    addUser() {
        const user = User.create({
            email: "",
            permissions: Permissions.create({ level: PermissionLevel.Full })
        })
        this.present(new ComponentWithProperties(EditUserView, { 
            user,
            isNew: true,
            saveHandler: async (patch: PatchableArrayAutoEncoder<NewUser>) => {
                await this.patchUsers(patch)
            }
        }).setDisplayStyle("popup"))
    }

    editAdmin(user: User) {
        this.present(new ComponentWithProperties(EditUserView, { 
            user,
            isNew: false,
            saveHandler: async (patch: PatchableArrayAutoEncoder<NewUser>) => {
                await this.patchUsers(patch)
            }
        }).setDisplayStyle("popup"))
    }

    async patch(patch: AutoEncoderPatchType<OrganizationSummary>) {
        const response = await AdminSession.shared.authenticatedServer.request({
            method: "PATCH",
            path: "/organizations/"+this.organization.id,
            body: patch,
            decoder: OrganizationSummary as Decoder<OrganizationSummary>
        })
        this.organization = response.data
    }

    async patchUsers(patch: PatchableArrayAutoEncoder<NewUser>) {
        await AdminSession.shared.authenticatedServer.request({
            method: "PATCH",
            path: "/organizations/"+this.organization.id+"/users",
            body: patch,
        })
        await this.reload()
    }

    async reload() {
        try {
            const response = await AdminSession.shared.authenticatedServer.request({
                method: "GET",
                path: "/organizations/"+this.organization.id,
                decoder: OrganizationSummary as Decoder<OrganizationSummary>
            })
            this.organization.set(response.data)
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    /// Admins

    get roles() {
        return this.organization?.privateMeta?.roles ?? []
    }

    get admins() {
        return this.organization?.admins ?? []
    }

    get sortedAdmins() {
        return this.admins.slice().sort((a, b) => Sorter.stack(Sorter.byBooleanValue(a.permissions?.hasFullAccess(this.organization?.privateMeta?.roles ?? []) ?? false, b.permissions?.hasFullAccess(this.organization?.privateMeta?.roles ?? []) ?? false), Sorter.byStringValue(a.firstName+" "+a.lastName, b.firstName+" "+b.lastName)))
    }

    permissionList(user: User) {
        const list: string[] = []
        if (user.permissions?.hasFullAccess(this.organization?.privateMeta?.roles ?? [])) {
            list.push("Hoofdbeheerders")
        }

        for (const role of user.permissions?.roles ?? []) {
            list.push(role.name)
        }
        return list.join(", ")
    }
}
</script>
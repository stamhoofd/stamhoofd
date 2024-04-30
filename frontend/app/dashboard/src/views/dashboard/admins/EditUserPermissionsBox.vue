<template>
    <div>
        <STList>
            <STListItem element-name="label" :selectable="true" class="right-description smartphone-wrap">
                <template #left>
                    <Checkbox v-model="fullAccess" />
                </template>
                Hoofdbeheerder

                <template #right>
                    Kan alles bekijken en bewerken
                </template>
            </STListItem>

            <STListItem v-for="role in roles" :key="role.id" element-name="label" :selectable="true" class="right-description smartphone-wrap">
                <template #left>
                    <Checkbox :modelValue="getRole(role)" @update:modelValue="setRole(role, $event)" />
                </template>
                {{ role.name }}
            </STListItem>
        </STList>

        <p v-if="roles.length == 0" class="info-box">
            Je hebt nog geen rollen aangemaakt. Maak een rol aan om beheerders op te delen.
        </p>

        <p class="style-button-bar">
            <button class="button text" type="button" @click="editRoles">
                <span class="icon edit" />
                <span>Rollen bewerken</span>
            </button>
        </p>
    </div>
</template>

<script lang="ts">
import { PartialWithoutMethods, PatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem } from "@stamhoofd/components";
import { PermissionLevel, PermissionRole, Permissions, User } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import AdminRolesView from './AdminRolesView.vue';

@Component({
    components: {
        Checkbox,
        STList,
        STListItem
    }
})
export default class EditUserPermissionsBox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        user!: User

    get organization() {
        return this.$organization
    }

    get patchedUser() {
        return this.user
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }

    getRole(role: PermissionRole) {
        return !!this.patchedUser.permissions?.roles.find(r => r.id === role.id)
    }

    setRole(role: PermissionRole, enable: boolean) {
        const p = Permissions.patch({})

        if (enable) {
            if (this.getRole(role)) {
                return
            }
            p.roles.addPut(role)
        } else {
            p.roles.addDelete(role.id)
        }
        this.addPermissionsPatch(p)
    }

    editRoles() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: new ComponentWithProperties(AdminRolesView, { }),
                })
            ],
            modalDisplayStyle: "popup",
            animated: true
        })
    }

    /// --------------------------------------------------------
    /// --------------------- Map helpers ----------------------
    /// --------------------------------------------------------

    addPatch(patch: PartialWithoutMethods<PatchType<User>>) {
        this.$emit('patch', User.patch(patch))
    }

    addPermissionsPatch(patch: PartialWithoutMethods<PatchType<Permissions>>) {
        this.addPatch({ permissions: Permissions.patch(patch) })
    }

    get fullAccess() {
        const user = this.patchedUser
        return !!user.permissions && user.permissions.hasFullAccess(this.organization.privateMeta?.roles ?? [])
    }

    set fullAccess(fullAccess: boolean) {
        if (fullAccess && this.fullAccess) {
            return
        }

        if (fullAccess) {
            this.addPermissionsPatch({ level: PermissionLevel.Full })
        } else {
            this.addPermissionsPatch({ level: PermissionLevel.None })
        }
    }
}
</script>
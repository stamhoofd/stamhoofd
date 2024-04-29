<template>
    <STListItem element-name="label" :selectable="true">
        <Checkbox #left v-model="selectGroup" />
        <h2 class="style-title-list">
            {{ showRole ? role.name : group.settings.name }}
        </h2>
        <p v-if="showRole && isMe" class="style-description-small">
            Jij zit in deze groep
        </p>

        <template #right><div v-if="selectGroup">
            <button class="button text" type="button" @click.stop.prevent="chooseGroupPermission(group, $event)">
                <span>{{ getLevelText(getGroupPermission(group)) }}</span>
                <span class="icon arrow-down-small" />
            </button>
        </div></template>
    </STListItem>
</template>


<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STListItem } from "@stamhoofd/components";
import { Group, GroupPrivateSettings, Organization, OrganizationPrivateMetaData, PermissionRole,PermissionRoleDetailed, PermissionsByRole } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";


import GroupPermissionContextMenu from './GroupPermissionContextMenu.vue';

@Component({
    components: {
        Checkbox,
        STListItem
    }
})
export default class GroupPermissionRow extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        group: Group

    @Prop({ required: true })
        role: PermissionRoleDetailed

    @Prop({ required: true })
        organization: Organization

    @Prop({ default: false })
        showRole!: boolean
   
    addRolePatch(patch: AutoEncoderPatchType<PermissionRoleDetailed>) {
        const privateMeta = OrganizationPrivateMetaData.patch({})
        privateMeta.roles.addPatch(PermissionRoleDetailed.patch(Object.assign({}, patch, { id: this.role.id })))

        this.addPatch(Organization.patch({
            privateMeta
        }))
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.$emit("patch", patch)
    }

    get selectGroup() {
        return this.getGroupPermission(this.group) !== "none"
    }

    get isMe() {
        return !!this.$organizationManager.user.permissions?.roles.find(r => r.id === this.role.id)
    }

    set selectGroup(selected: boolean) {
        if (selected === this.selectGroup) {
            return
        }
        
        if (selected) {
            this.setGroupPermission(this.group, "read")
        } else {
            this.setGroupPermission(this.group, "none")
        }
    }

    getGroupPermission(group: Group): "none" | "write" | "read" | "full" {
        for (const role of group.privateSettings!.permissions.full) {
            if (role.id === this.role.id) {
                return "full"
            }
        }

        for (const role of group.privateSettings!.permissions.write) {
            if (role.id === this.role.id) {
                return "write"
            }
        }

        for (const role of group.privateSettings!.permissions.read) {
            if (role.id === this.role.id) {
                return "read"
            }
        }

        return "none"
    }

    setGroupPermission(group: Group, level: "none" | "write" | "read" | "full") {
        if (this.getGroupPermission(group) === level) {
            return
        }

        const p = Organization.patch({ id: this.organization.id })
        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        if (level === "none") {
            p.groups.addPatch(Group.patch({
                id: group.id,
                privateSettings: GroupPrivateSettings.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: del,
                        full: del
                    })
                })
            }))
            this.addPatch(p)
            return
        }

        if (level === "read") {
            p.groups.addPatch(Group.patch({
                id: group.id,
                privateSettings: GroupPrivateSettings.patch({
                    permissions: PermissionsByRole.patch({
                        read: add,
                        write: del,
                        full: del
                    })
                })
            }))
            this.addPatch(p)
            return
        }

        if (level === "write") {
            p.groups.addPatch(Group.patch({
                id: group.id,
                privateSettings: GroupPrivateSettings.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: add,
                        full: del
                    })
                })
            }))
            this.addPatch(p)
            return
        }

        if (level === "full") {
            p.groups.addPatch(Group.patch({
                id: group.id,
                privateSettings: GroupPrivateSettings.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: del,
                        full: add
                    })
                })
            }))
            this.addPatch(p)
            return
        }
    }

    getLevelText(level: "none" | "write" | "read" | "full"): string {
        switch(level) {
            case "none": return "Geen toegang";
            case "write": return "Bewerken";
            case "read": return "Lezen";
            case "full": return "Volledige toegang";
        }
    }

    chooseGroupPermission(group, event) {
        const el = event.currentTarget
        const displayedComponent = new ComponentWithProperties(GroupPermissionContextMenu, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            xPlacement: "left",
            yPlacement: "bottom",
            callback: (level: "none" | "write" | "read" | "full") => {
                this.setGroupPermission(group, level)
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}

</script>
<template>
    <STListItem element-name="label" :selectable="true">
        <Checkbox slot="left" v-model="selected" />
        <h2 class="style-title-list">
            {{ role.name }}
        </h2>
        <p v-if="isMe" class="style-description-small">
            Jij zit in deze groep
        </p>

        <div v-if="selected" slot="right">
            <button class="button text" type="button" @click.stop.prevent="choosePermissions($event)">
                <span>{{ getLevelText(permissions) }}</span>
                <span class="icon arrow-down-small" />
            </button>
        </div>
    </STListItem>
</template>


<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STListItem } from "@stamhoofd/components";
import { Organization, PermissionRole, PermissionsByRole, PrivateWebshop, WebshopPrivateMetaData } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import GroupPermissionContextMenu from './GroupPermissionContextMenu.vue';

@Component({
    components: {
        Checkbox,
        STListItem
    }
})
export default class WebshopRolePermissionRow extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    webshop: PrivateWebshop

    @Prop({ required: true })
    role: PermissionRole

    @Prop({ required: true })
    organization: Organization

    addPatch(patch: AutoEncoderPatchType<PrivateWebshop>) {
        this.$emit("patch", patch)
    }

    get isMe() {
        return !!OrganizationManager.user.permissions?.roles.find(r => r.id === this.role.id)
    }

    get selected() {
        return this.permissions !== "none"
    }

    set selected(selected: boolean) {
        if (selected === this.selected) {
            return
        }
        
        if (selected) {
            this.permissions = "read"
        } else {
            this.permissions = "none"
        }
    }

    get permissions(): "none" | "write" | "read" | "full" {
        for (const role of this.webshop.privateMeta?.permissions.full) {
            if (role.id === this.role.id) {
                return "full"
            }
        }

        for (const role of this.webshop.privateMeta?.permissions.write) {
            if (role.id === this.role.id) {
                return "write"
            }
        }

        for (const role of this.webshop.privateMeta?.permissions.read) {
            if (role.id === this.role.id) {
                return "read"
            }
        }

        return "none"
    }

    set permissions(level: "none" | "write" | "read" | "full") {
        if (this.permissions === level) {
            return
        }

        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        if (level === "none") {
            this.addPatch(PrivateWebshop.patch({
                id: this.webshop.id,
                privateMeta: WebshopPrivateMetaData.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: del,
                        full: del
                    })
                })
            }))
            return
        }

        if (level === "read") {
            this.addPatch(PrivateWebshop.patch({
                id: this.webshop.id,
                privateMeta: WebshopPrivateMetaData.patch({
                    permissions: PermissionsByRole.patch({
                        read: add,
                        write: del,
                        full: del
                    })
                })
            }))
            return
        }

        if (level === "write") {
            this.addPatch(PrivateWebshop.patch({
                id: this.webshop.id,
                privateMeta: WebshopPrivateMetaData.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: add,
                        full: del
                    })
                })
            }))
            return
        }

        if (level === "full") {
            this.addPatch(PrivateWebshop.patch({
                id: this.webshop.id,
                privateMeta: WebshopPrivateMetaData.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: del,
                        full: add
                    })
                })
            }))
            return
        }
    }

    getLevelText(level: "none" | "write" | "read" | "full"): string {
        switch(level) {
            case "none": return "Geen toegang";
            case "write": return "Bekijken en bewerken";
            case "read": return "Bekijken";
            case "full": return "Volledige toegang";
        }
    }

    choosePermissions(event) {
        const el = event.currentTarget
        const displayedComponent = new ComponentWithProperties(GroupPermissionContextMenu, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            xPlacement: "left",
            yPlacement: "bottom",
            callback: (level: "none" | "write" | "read" | "full") => {
                this.permissions = level
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}

</script>
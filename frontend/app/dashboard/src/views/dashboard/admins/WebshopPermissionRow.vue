<template>
    <STListItem element-name="label" :selectable="true">
        <Checkbox slot="left" v-model="selected" />
        <h2 class="style-title-list">
            {{ webshop.meta.name }}
        </h2>

        <div slot="right" v-if="selected">
            <button class="button text" @click.stop.prevent="choosePermissions($event)">
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
import { Organization, OrganizationPrivateMetaData, PermissionRole,PermissionRoleDetailed, PermissionsByRole, WebshopPreview, WebshopPrivateMetaData } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
import GroupPermissionContextMenu from './GroupPermissionContextMenu.vue';

@Component({
    components: {
        Checkbox,
        STListItem
    }
})
export default class WebshopPermissionRow extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    webshop: WebshopPreview

    @Prop({ required: true })
    role: PermissionRoleDetailed

    @Prop({ required: true })
    organization: Organization

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.$emit("patch", patch)
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

        const p = Organization.patch({ id: this.organization.id })
        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        if (level === "none") {
            p.webshops.addPatch(WebshopPreview.patch({
                id: this.webshop.id,
                privateMeta: WebshopPrivateMetaData.patch({
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
            p.webshops.addPatch(WebshopPreview.patch({
                id: this.webshop.id,
                privateMeta: WebshopPrivateMetaData.patch({
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
            p.webshops.addPatch(WebshopPreview.patch({
                id: this.webshop.id,
                privateMeta: WebshopPrivateMetaData.patch({
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
            p.webshops.addPatch(WebshopPreview.patch({
                id: this.webshop.id,
                privateMeta: WebshopPrivateMetaData.patch({
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
            case "write": return "Bekijken en bewerken";
            case "read": return "Bekijken";
            case "full": return "Volledige toegang";
        }
    }

    choosePermissions(event) {
        const displayedComponent = new ComponentWithProperties(GroupPermissionContextMenu, {
            x: event.clientX,
            y: event.clientY,
            callback: (level: "none" | "write" | "read" | "full") => {
                this.permissions = level
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}

</script>
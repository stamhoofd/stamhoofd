<template>
    <STListItem element-name="label" :selectable="true">
        <Checkbox slot="left" v-model="selectCategory" />
        <h2 class="style-title-list">
            {{ category.settings.name }}
        </h2>

        <div slot="right" v-if="selectCategory">
            <button class="button text">
                {{ getLevelText(getGroupPermission(category)) }}
            </button>
        </div>
    </STListItem>
</template>


<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STListItem } from "@stamhoofd/components";
import { GroupCategory, GroupCategoryPermissions, GroupCategorySettings, OrganizationMetaData } from '@stamhoofd/structures';
import { Organization, OrganizationPrivateMetaData, PermissionRole,PermissionRoleDetailed } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        Checkbox,
        STListItem
    }
})
export default class CategoryPermissionRow extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    category: GroupCategory

    @Prop({ required: true })
    role: PermissionRoleDetailed

    @Prop({ required: true })
    organization: Organization
   
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

    get selectCategory() {
        return this.getGroupPermission(this.category) !== "none"
    }

    set selectCategory(selected: boolean) {
        if (selected === this.selectCategory) {
            return
        }
        
        if (selected) {
            this.setCategoryPermission(this.category, "create")
        } else {
            this.setCategoryPermission(this.category, "none")
        }
    }

    getGroupPermission(category: GroupCategory): "none" | "create" {
        for (const role of category.settings!.permissions.create) {
            if (role.id === this.role.id) {
                return "create"
            }
        }      

        return "none"
    }

    setCategoryPermission(category: GroupCategory, level: "none" | "create") {
        if (this.getGroupPermission(category) === level) {
            return
        }

        const p = Organization.patch({ id: this.organization.id })
        const meta = OrganizationMetaData.patch({})
        p.meta = meta

        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        if (level === "none") {
            meta.categories.addPatch(GroupCategory.patch({
                id: category.id,
                settings: GroupCategorySettings.patch({
                    permissions: GroupCategoryPermissions.patch({
                        create: del
                    })
                })
            }))
            this.addPatch(p)
            return
        }

        if (level === "create") {
            meta.categories.addPatch(GroupCategory.patch({
                id: category.id,
                settings: GroupCategorySettings.patch({
                    permissions: GroupCategoryPermissions.patch({
                        create: add
                    })
                })
            }))
            this.addPatch(p)
            return
        }
    }

    getLevelText(level: "none" | "create"): string {
        switch(level) {
            case "none": return "Geen toegang";
            case "create": return "Kan nieuwe groepen maken";
        }
    }
}

</script>
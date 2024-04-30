<template>
    <STListItem element-name="label" :selectable="true">
        <template #left>
            <Checkbox v-model="selected" />
        </template>
        <h2 v-if="type === 'category'" class="style-title-list">
            {{ category.settings.name }}
        </h2>
        <template v-else>
            <h2 class="style-title-list">
                {{ role.name }}
            </h2>
            <p v-if="isMe" class="style-description-small">
                Jij zit in deze groep
            </p>
        </template>

        <template #right><div v-if="selected">
            <button class="button text" type="button" @click.stop.prevent="choosePermissions($event)">
                <span>{{ levelText }}</span>
                <span class="icon arrow-down-small" />
            </button>
        </div></template>
    </STListItem>
</template>


<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ContextMenu, ContextMenuItem, STListItem } from "@stamhoofd/components";
import { GroupCategory, GroupCategoryPermissions, GroupCategorySettings, Organization, OrganizationMetaData, PermissionLevel, PermissionRole, PermissionRoleDetailed, PermissionsByRole } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";



@Component({
    components: {
        Checkbox,
        STListItem
    }
})
export default class GroupCategoryPermissionRow extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        category: GroupCategory

    @Prop({ required: true })
        role: PermissionRoleDetailed

    @Prop({ required: true })
        organization: Organization

    @Prop({ required: true })
        type: 'category' | 'role'

    addPatch(patch: AutoEncoderPatchType<GroupCategory>) {
        if (this.type === 'role') {
            this.$emit("patch", patch)
        } else {
            const meta = OrganizationMetaData.patch({})
            meta.categories.addPatch(patch);

            const p = Organization.patch({ 
                id: this.organization.id,
                meta
            })
            this.$emit("patch", p)
        }
    }

    get isMe() {
        return !!this.$organizationManager.user.permissions?.roles.find(r => r.id === this.role.id)
    }

    get selected() {
        return this.canCreate || this.permissions !== PermissionLevel.None
    }

    set selected(selected: boolean) {
        if (selected === this.selected) {
            return
        }
        
        if (selected) {
            this.canCreate = true
        } else {
            this.permissions = PermissionLevel.None
            this.canCreate = false
        }
    }

    get canCreate() {
        return !!this.category.settings.permissions.create.find(r => r.id === this.role.id)
    }

    set canCreate(enable: boolean) {
        if (this.canCreate === enable) {
            return;
        }

        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        this.addPatch(GroupCategory.patch({
            id: this.category.id,
            settings: GroupCategorySettings.patch({
                permissions: GroupCategoryPermissions.patch({
                    create: enable ? add : del
                })
            })
        }))
    }

    get permissions(): PermissionLevel {
        return this.category.settings.permissions.groupPermissions.getRolePermissionLevel(this.role) ?? PermissionLevel.None
    }

    set permissions(level: PermissionLevel) {
        if (this.permissions === level) {
            return
        }

        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        this.addPatch(GroupCategory.patch({
            id: this.category.id,
            settings: GroupCategorySettings.patch({
                permissions: GroupCategoryPermissions.patch({
                    groupPermissions: PermissionsByRole.patch({
                        read: level === PermissionLevel.Read ? add : del,
                        write: level === PermissionLevel.Write ? add : del,
                        full: level === PermissionLevel.Full ? add : del
                    })
                })
            })
        }))
    }

    get levelText(): string {
        switch(this.permissions) {
            case PermissionLevel.None: {
                if (this.canCreate) {
                    return "Groepen maken"
                }
                return "Geen toegang";
            }
            case PermissionLevel.Read: {
                if (this.canCreate) {
                    return "Lezen + groepen maken"
                }
                return "Lezen";
            }
            case PermissionLevel.Write:  {
                if (this.canCreate) {
                    return "Bewerken + groepen maken"
                }
                return "Bewerken";
            }
            case PermissionLevel.Full: {
                if (this.canCreate) {
                    return "Volledig + groepen maken"
                }
                return "Volledig";
            }
            default: {
                const _exhaustiveCheck: never = this.permissions;
                return _exhaustiveCheck;
            }
        }
    }

    choosePermissions(event) {
        const contextMenu = new ContextMenu([
            [
                new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.None,
                    name: 'Geen toegang',
                    description: 'Kan geen leden bekijken tenzij toegang individueel per groep is ingesteld',
                    action: () => {
                        this.permissions = PermissionLevel.None
                        return false
                    }
                }),

                new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.Read,
                    name: 'Lezen',
                    description: 'Alle leden bekijken',
                    action: () => {
                        if (this.permissions === PermissionLevel.Read) {
                            this.permissions = PermissionLevel.None
                            return false
                        }
                        this.permissions = PermissionLevel.Read
                        return false
                    }
                }),

                new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.Write,
                    name: 'Bewerken',
                    description: 'Alle leden bekijken en bewerken',
                    action: () => {
                        if (this.permissions === PermissionLevel.Write) {
                            this.permissions = PermissionLevel.None
                            return false
                        }
                        this.permissions = PermissionLevel.Write
                        return false
                    }
                }),

                new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.Full,
                    name: 'Volledige toegang',
                    description: 'Alle leden bekijken en bewerken en de instellingen van de groepen aanpassen',
                    action: () => {
                        if (this.permissions === PermissionLevel.Full) {
                            this.permissions = PermissionLevel.None
                            return false
                        }
                        this.permissions = PermissionLevel.Full
                        return false
                    }
                })
            ], [
                new ContextMenuItem({
                    selected: this.canCreate,
                    name: 'Groepen maken',
                    description: 'Kan nieuwe groepen maken in deze categorie',
                    action: () => {
                        this.canCreate = !this.canCreate
                        return false
                    }
                }),
            ]
        ])

        contextMenu.show({
            button: event.currentTarget,
            xPlacement: "left",
            yPlacement: "bottom",
        }).catch(console.error)
    }
}

</script>
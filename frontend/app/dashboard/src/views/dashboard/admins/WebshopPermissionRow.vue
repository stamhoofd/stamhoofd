<template>
    <STListItem element-name="label" :selectable="true">
        <template #left>
            <Checkbox v-model="selected" />
        </template>
        <h2 v-if="type === 'webshop'" class="style-title-list">
            {{ webshop.meta.name }}
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
import { Organization, PermissionLevel, PermissionRole, PermissionRoleDetailed, PermissionsByRole, WebshopPreview, WebshopPrivateMetaData } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";



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

    @Prop({ required: true })
        type: 'webshop' | 'role'

    addPatch(patch: AutoEncoderPatchType<WebshopPreview>) {
        if (this.type === 'role') {
            this.$emit("patch", patch)
        } else {
            const p = Organization.patch({ id: this.organization.id })
            p.webshops.addPatch(patch);
            this.$emit("patch", p)
        }
    }

    get isMe() {
        return !!this.$organizationManager.user.permissions?.roles.find(r => r.id === this.role.id)
    }

    get selected() {
        return this.permissions !== PermissionLevel.None || this.scanPermissions !== PermissionLevel.None
    }

    set selected(selected: boolean) {
        if (selected === this.selected) {
            return
        }
        
        if (selected) {
            this.permissions = PermissionLevel.Read
        } else {
            this.permissions = PermissionLevel.None
            this.scanPermissions = PermissionLevel.None
        }
    }

    get permissions(): PermissionLevel {
        return this.webshop.privateMeta?.permissions?.getRolePermissionLevel(this.role) ?? PermissionLevel.None
    }

    set permissions(level: PermissionLevel) {
        if (this.permissions === level) {
            return
        }

        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        this.addPatch(WebshopPreview.patch({
            id: this.webshop.id,
            privateMeta: WebshopPrivateMetaData.patch({
                permissions: PermissionsByRole.patch({
                    read: level === PermissionLevel.Read ? add : del,
                    write: level === PermissionLevel.Write ? add : del,
                    full: level === PermissionLevel.Full ? add : del
                })
            })
        }))
    }

    get scanPermissions(): PermissionLevel {
        return this.webshop.privateMeta?.scanPermissions?.getRolePermissionLevel(this.role) ?? PermissionLevel.None
    }

    set scanPermissions(level: PermissionLevel) {
        if (this.scanPermissions === level) {
            return
        }

        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        this.addPatch(WebshopPreview.patch({
            id: this.webshop.id,
            privateMeta: WebshopPrivateMetaData.patch({
                scanPermissions: PermissionsByRole.patch({
                    write: level === PermissionLevel.Write ? add : del,
                })
            })
        }))
    }

    get levelText(): string {
        switch(this.permissions) {
            case PermissionLevel.None: {
                if (this.scanPermissions !== PermissionLevel.None) {
                    return "Scannen"
                }
                return "Geen toegang";
            }
            case PermissionLevel.Read: {
                if (this.scanPermissions !== PermissionLevel.None) {
                    return "Lezen + scannen"
                }
                return "Lezen";
            }
            case PermissionLevel.Write: return "Bewerken";
            case PermissionLevel.Full: return "Volledige toegang";
            default: {
                const _exhaustiveCheck: never = this.permissions;
                return _exhaustiveCheck;
            }
        }
    }

    choosePermissions(event) {
        const hasTickets = this.webshop.hasTickets || this.scanPermissions !== PermissionLevel.None
        const contextMenu = new ContextMenu([
            [
                ...(hasTickets ? [new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.None && this.scanPermissions === PermissionLevel.Write,
                    name: 'Enkel scannen',
                    description: 'Geen toegang tot bestellingen',
                    action: () => {
                        this.permissions = PermissionLevel.None
                        this.scanPermissions = PermissionLevel.Write
                        return false
                    }
                })] : []),
                new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.Read && this.scanPermissions === PermissionLevel.None,
                    name: 'Lezen',
                    description: 'Alle bestellingen bekijken',
                    action: () => {
                        this.permissions = PermissionLevel.Read
                        this.scanPermissions = PermissionLevel.None
                        return false
                    }
                }),
                ...(hasTickets ? [new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.Read && this.scanPermissions === PermissionLevel.Write,
                    name: 'Lezen + scannen',
                    description: 'Alle bestellingen bekijken en scannen van tickets',
                    action: () => {
                        this.permissions = PermissionLevel.Read
                        this.scanPermissions = PermissionLevel.Write
                        return false
                    }
                })] : []),
                new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.Write,
                    name: 'Bewerken',
                    description: hasTickets ? 'Alle bestellingen bekijken, bewerken en scannen' : 'Alle bestellingen bekijken en bewerken',
                    action: () => {
                        this.permissions = PermissionLevel.Write
                        this.scanPermissions = PermissionLevel.None
                        return false
                    }
                }),
                new ContextMenuItem({
                    selected: this.permissions === PermissionLevel.Full,
                    name: 'Volledige toegang',
                    description: hasTickets ? 'Instellingen wijzigen en alle bestellingen bekijken, bewerken of scannen' : 'Instellingen wijzigen en alle bestellingen bekijken of bewerken',
                    action: () => {
                        this.permissions = PermissionLevel.Full
                        this.scanPermissions = PermissionLevel.None
                        return false
                    }
                })
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
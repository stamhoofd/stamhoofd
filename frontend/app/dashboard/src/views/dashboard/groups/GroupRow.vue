<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editGroup()" @contextmenu.prevent="showContextMenu">
        <template #left>
            <GroupAvatar :group="group" />
        </template>
        
        <h2 class="style-title-list">
            {{ group.settings.name }}
        </h2>
        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { ContextMenu, ContextMenuItem, GroupAvatar, LongPressDirective, STListItem, EditGroupView } from "@stamhoofd/components";
import { Group, GroupCategory, Organization, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

@Component({
    components: {
        STListItem,
        GroupAvatar
    },
    directives: {
        LongPress: LongPressDirective
    }
})
export default class GroupRow extends Mixins(NavigationMixin) {
    @Prop({})
        group: Group

    @Prop({})
        organization: Organization

    @Prop({})
        period: OrganizationRegistrationPeriod

    get imageSrc() {
        return (this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)?.getPathForSize(50, 50)
    }

    editGroup() {
        this.present(new ComponentWithProperties(EditGroupView, { 
            group: this.group, 
            isNew: false,
            saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                const p = OrganizationRegistrationPeriod.patch({})
                p.groups.addPatch(patch)
                this.$emit("patch:period", p)
            },
            deleteHandler: () => {
                const settings = OrganizationRegistrationPeriodSettings.patch({})
                const pp = GroupCategory.patch({id:this.parentCategory.id})
                pp.groupIds.addDelete(this.group.id)
                settings.categories.addPatch(pp)

                const q = OrganizationRegistrationPeriod.patch({
                    settings
                })
                q.groups.addDelete(this.group.id)

                this.$emit('patch:period', q)
            }
        }).setDisplayStyle("popup"))
    }

    get parentCategory() {
        return this.group.getParentCategories(this.period.settings.categories)[0]
    }

    get subGroups() {
        return this.parentCategory.groupIds.map(id => this.period.groups.find(g => g.id === id)!).filter(g => !!g)
    }

    get allCategories() {
        const parentCategory = this.parentCategory;
        return this.period.availableCategories.filter(c => c.categories.length == 0 && c.id !== parentCategory?.id)
    }

    moveTo(category: GroupCategory) {
        const p = GroupCategory.patch({id: category.id})
        p.groupIds.addPut(this.group.id)

        const settings = OrganizationRegistrationPeriodSettings.patch({})
        settings.categories.addPatch(p)

        const pp = GroupCategory.patch({id: this.parentCategory.id})
        pp.groupIds.addDelete(this.group.id)
        settings.categories.addPatch(pp)

        const q = OrganizationRegistrationPeriod.patch({
            settings
        })

        this.$emit('patch:period', q)
    }

    duplicate() {
        const duplicated = this.group.clone()
        duplicated.id = uuidv4();

        // Remove suffix
        duplicated.settings.name = duplicated.settings.name.replace(/ \(kopie( \d+)?\)$/, "")


        const suffix = " (kopie)";

        // Count the groups that already have a suffix, and add the numuber inside the suffix
        // use this.subGroups
        const suffixes = this.subGroups.map(g => g.settings.name.startsWith(duplicated.settings.name+" (kopie") && g.settings.name.match(/ \(kopie( \d+)?\)$/))
        const suffixesWithNumber = suffixes.filter(s => !!s) as RegExpMatchArray[]
        console.log(suffixesWithNumber);

        const maxNumber = suffixesWithNumber.length > 0 ? Math.max(...suffixesWithNumber.map(s => parseInt(s[1] ?? "1"))) : 0

        if (maxNumber > 0) {
            duplicated.settings.name = duplicated.settings.name + " (kopie " + (maxNumber + 1) + ")";
        } else {
            duplicated.settings.name = duplicated.settings.name + suffix;
        }
        
        const p = GroupCategory.patch({id: this.parentCategory.id})
        p.groupIds.addPut(duplicated.id, this.group.id)

        const settings = OrganizationRegistrationPeriodSettings.patch({})
        settings.categories.addPatch(p)

        const organizationPatch = OrganizationRegistrationPeriod.patch({
            settings,
        });

        organizationPatch.groups.addPut(duplicated)
        this.$emit('patch:period', organizationPatch)
    }

    showContextMenu(event: MouseEvent) {
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: "Verplaats naar",
                    disabled: this.allCategories.length == 0,
                    childMenu: new ContextMenu([
                        this.allCategories.map(cat => 
                            new ContextMenuItem({
                                name: cat.settings.name,
                                rightText: cat.groupIds.length+"",
                                action: () => {
                                    this.moveTo(cat)
                                    return true
                                }
                            })
                        )
                    ])
                }),

                new ContextMenuItem({
                    name: "Dupliceren",
                    icon: "copy",
                    action: () => {
                        this.duplicate()
                        return true;
                    }
                }),

                new ContextMenuItem({
                    name: "Verwijderen",
                    icon: "trash",
                    action: () => {
                        const settings = OrganizationRegistrationPeriodSettings.patch({})
                        const pp = GroupCategory.patch({id:this.parentCategory.id})
                        pp.groupIds.addDelete(this.group.id)
                        settings.categories.addPatch(pp)

                        const q = OrganizationRegistrationPeriod.patch({
                            settings
                        })
                        q.groups.addDelete(this.group.id)


                        this.$emit('patch:period', q)

                        return true;
                    }
                }),
            ]
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-row-image {
    width: 50px;
    height: 50px;
    margin: -5px 0;
    border-radius: $border-radius;
}
</style>

<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editCategory()" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ category.settings.name }}
        </h2>
        <p class="style-description-small">
            {{ description }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, LongPressDirective, STListItem } from "@stamhoofd/components";
import { GroupCategory, Organization, OrganizationMetaData } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditCategoryGroupsView from './EditCategoryGroupsView.vue';

@Component({
    components: {
        STListItem
    },
    directives: {
        LongPress: LongPressDirective
    }
})
export default class GroupCategoryRow extends Mixins(NavigationMixin) {
    @Prop({})
    category: GroupCategory

    @Prop({})
    organization: Organization

    editCategory() {
        this.present(new ComponentWithProperties(EditCategoryGroupsView, { 
            category: this.category, 
            organization: this.organization, 
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.$emit("patch", patch)
            }
        }).setDisplayStyle("popup"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }

    get parentCategory() {
        return this.category.getParentCategories(this.organization.meta.categories)[0]
    }

    get grandParentCategory() {
        return this.parentCategory?.getParentCategories(this.organization.meta.categories)[0]
    }

    get subCategories() {
        return this.parentCategory.categoryIds.map(id => this.organization.meta.categories.find(c => c.id == id)!).filter(c => c && c.id !== this.category.id)
    }

    get childCategories() {
        return this.category.categoryIds.map(id => this.organization.meta.categories.find(c => c.id == id)!).filter(c => c)
    }

    get childGroups() {
        return this.category.groupIds.map(id => this.organization.groups.find(g => g.id == id)!).filter(g => g)
    }

    get description() {
        if (this.category.groupIds.length == 0 && this.category.categoryIds.length == 0) {
            return "Leeg"
        }

        const childGroups = this.childGroups;

        if (childGroups.length > 0) {
            if (childGroups.length > 4) {
                return `${childGroups.length} groepen (${childGroups.slice(0, 2).map(g => g.settings.name).join(", ")}...)`
            }

            return `${childGroups.length} groepen (${Formatter.joinLast(childGroups.map(g => g.settings.name), ", ", " en ")})`
        }

        const childCategories = this.childCategories;

        if (childCategories.length > 4) {
            return `${childCategories.length} categorieën (${childCategories.slice(0, 2).map(g => g.settings.name).join(", ")}...)`
        }

        return `${childCategories.length} categorieën (${Formatter.joinLast(childCategories.map(g => g.settings.name), ", ", " en ")})`
    }

    moveTo(category: GroupCategory) {
        const p = GroupCategory.patch({id: category.id})
        p.categoryIds.addPut(this.category.id)

        const meta = OrganizationMetaData.patch({})
        meta.categories.addPatch(p)

        this.$emit('patch', Organization.patch({
            meta
        }))
        this.$emit("delete")
    }

    mergeDisabledWith(category: GroupCategory): boolean | string {
        if (this.category.groupIds.length == 0 && this.category.categoryIds.length == 0) {
            return "Een lege categorie kan je niet samenvoegen met een andere. Dat is hetzelfde als verwijderen."
        }

        // Ignore own category id
        const filteredCategoryIds = category.categoryIds.filter(id => id !== this.category.id)

        if (category.groupIds.length == 0 && filteredCategoryIds.length == 0) {
            return false;
        }

        if (category.groupIds.length > 0) {
            if (this.category.categoryIds.length > 0) {
                return `${category.settings.name || 'De hoofdcategorie'} bevat groepen, daarbij kan je de subcategorieën van ${this.category.settings.name} niet samenvoegen.`;
            }
            return false;
        }

        if (this.category.groupIds.length > 0) {
            return `${category.settings.name || 'De hoofdcategorie'} bevat al categorieën, daarbij kan je de groepen van ${this.category.settings.name} niet samenvoegen.`;
        }
        return false;
    }

    mergeWith(category: GroupCategory) {
        const p = GroupCategory.patch({id: category.id})
        for (const childCatId of this.category.categoryIds) {
            p.categoryIds.addPut(childCatId)
        }

        for (const childGroupId of this.category.groupIds) {
            p.groupIds.addPut(childGroupId)
        }

        const meta = OrganizationMetaData.patch({})
        meta.categories.addPatch(p)

        this.$emit('patch', Organization.patch({
            meta
        }))
        this.$emit("delete")
    }

    showContextMenu(event) {
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: "Verplaats omhoog",
                    icon: "arrow-up",
                    action: () => {
                        this.moveUp()
                        return true;
                    }
                }),
                new ContextMenuItem({
                    name: "Verplaats omlaag",
                    icon: "arrow-down",
                    action: () => {
                        this.moveDown()
                        return true;
                    }
                }),
            ],

            [
                new ContextMenuItem({
                    name: "Verplaats naar",
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: "Bovenliggende categorie",
                                disabled: !this.grandParentCategory,
                                action: () => {
                                    this.moveTo(this.grandParentCategory!)
                                    return true
                                }
                            })
                        ],
                        this.subCategories.map(cat => 
                            new ContextMenuItem({
                                name: cat.settings.name,
                                disabled: cat.groupIds.length > 0,
                                action: () => {
                                    this.moveTo(cat)
                                    return true
                                }
                            })
                        )
                    ])
                }),
                new ContextMenuItem({
                    name: "Verwijder en verplaats inhoud naar",
                    disabled: this.category.groupIds.length == 0 && this.category.categoryIds.length == 0,
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: this.grandParentCategory ? this.parentCategory.settings.name : "Hoofdcategorie",
                                disabled: this.mergeDisabledWith(this.parentCategory),
                                action: () => {
                                    this.mergeWith(this.parentCategory)
                                    return true
                                }
                            })
                        ],
                        this.subCategories.map(cat => 
                            new ContextMenuItem({
                                name: cat.settings.name,
                                disabled: this.mergeDisabledWith(cat),
                                action: () => {
                                    this.mergeWith(cat)
                                    return true
                                }
                            })
                        )
                    ])
                }),
                new ContextMenuItem({
                    name: "Verwijderen",
                    icon: "trash",
                    action: () => {
                        this.$emit("delete")
                        return true;
                    }
                }),
            ]
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }
}
</script>
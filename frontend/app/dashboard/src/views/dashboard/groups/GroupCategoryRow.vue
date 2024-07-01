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

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem, useEmitPatch, usePatchMoveUpDownIds } from '@stamhoofd/components';
import { GroupCategory, Organization, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';
import { computed } from 'vue';
import EditCategoryGroupsView from './EditCategoryGroupsView.vue';

const props = defineProps<{
    category: GroupCategory,
    organization: Organization,
    period: OrganizationRegistrationPeriod
}>()

const present = usePresent();
const emit = defineEmits(['patch:period'])
const {addPatch} = useEmitPatch(props, emit, 'period')
const parentCategory = computed(() => props.category.getParentCategories(props.period.settings.categories)[0])
const grandParentCategory = computed(() => parentCategory.value?.getParentCategories(props.period.settings.categories)[0])
const subCategories = computed(() => parentCategory.value.categoryIds.map(id => props.period.settings.categories.find(c => c.id == id)!).filter(c => c && c.id !== props.category.id))
const childCategories = computed(() => props.category.categoryIds.map(id => props.period.settings.categories.find(c => c.id == id)!).filter(c => c))
const childGroups = computed(() => props.category.groupIds.map(id => props.period.groups.find(g => g.id == id)!).filter(g => g))
const {up, down} = usePatchMoveUpDownIds(props.category.id, computed(() => parentCategory.value.categoryIds), (categoryIds) => {
    const patchCategory = GroupCategory.patch({id: parentCategory.value.id, categoryIds})
    const arr = new PatchableArray() as PatchableArrayAutoEncoder<GroupCategory>
    arr.addPatch(patchCategory)
    addPatch(OrganizationRegistrationPeriod.patch({
        settings: OrganizationRegistrationPeriodSettings.patch({
            categories: arr
        })
    }))
})

const description = computed(() => {
    if (props.category.groupIds.length == 0 && props.category.categoryIds.length == 0) {
        return "Leeg"
    }

    if (childGroups.value.length > 0) {
        if (childGroups.value.length > 4) {
            return `${childGroups.value.length} groepen (${childGroups.value.slice(0, 2).map(g => g.settings.name).join(", ")}...)`
        }

        return `${childGroups.value.length} groepen (${childGroups.value.map(g => g.settings.name).join(", ")})`
    }

    if (childCategories.value.length > 4) {
        return `${childCategories.value.length} categorieën (${childCategories.value.slice(0, 2).map(g => g.settings.name).join(", ")}...)`
    }

    return `${childCategories.value.length} categorieën (${childCategories.value.map(g => g.settings.name).join(", ")})`
})

async function editCategory() {
    await present({
        components: [
            new ComponentWithProperties(EditCategoryGroupsView, { 
                category: props.category, 
                organization: props.organization,
                period: props.period,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(patch)
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

function moveTo(category: GroupCategory) {
    const p = GroupCategory.patch({id: category.id})
    p.categoryIds.addPut(props.category.id)

    const settings = OrganizationRegistrationPeriodSettings.patch({})
    settings.categories.addPatch(p)

    // Delete
    const pp = GroupCategory.patch({id: parentCategory.value.id})
    pp.categoryIds.addDelete(props.category.id)

    settings.categories.addPatch(pp)

    addPatch(OrganizationRegistrationPeriod.patch({
        settings
    }))
}

function mergeDisabledWith(category: GroupCategory): boolean | string {
    if (props.category.groupIds.length == 0 && props.category.categoryIds.length == 0) {
        return "Een lege categorie kan je niet samenvoegen met een andere. Dat is hetzelfde als verwijderen."
    }

    // Ignore own category id
    const filteredCategoryIds = category.categoryIds.filter(id => id !== props.category.id)

    if (category.groupIds.length == 0 && filteredCategoryIds.length == 0) {
        return false;
    }

    if (category.groupIds.length > 0) {
        if (props.category.categoryIds.length > 0) {
            return `${category.settings.name || 'De hoofdcategorie'} bevat groepen, daarbij kan je de subcategorieën van ${props.category.settings.name} niet samenvoegen.`;
        }
        return false;
    }

    if (props.category.groupIds.length > 0) {
        return `${category.settings.name || 'De hoofdcategorie'} bevat al categorieën, daarbij kan je de groepen van ${props.category.settings.name} niet samenvoegen.`;
    }
    return false;
}

function mergeWith(category: GroupCategory) {
    const p = GroupCategory.patch({id: category.id})
    for (const childCatId of props.category.categoryIds) {
        p.categoryIds.addPut(childCatId)
    }

    for (const childGroupId of props.category.groupIds) {
        p.groupIds.addPut(childGroupId)
    }

    const settings = OrganizationRegistrationPeriodSettings.patch({})
    settings.categories.addPatch(p)

    // Delete
    const pp = GroupCategory.patch({id: parentCategory.value.id})
    pp.categoryIds.addDelete(props.category.id)
    settings.categories.addPatch(pp)

    addPatch(OrganizationRegistrationPeriod.patch({
        settings
    }))
}

function deleteMe() {
    const settings = OrganizationRegistrationPeriodSettings.patch({})
    const pp = GroupCategory.patch({id: parentCategory.value.id})
    pp.categoryIds.addDelete(props.category.id)
    settings.categories.addPatch(pp)

    addPatch(OrganizationRegistrationPeriod.patch({
        settings
    }))
}

async function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: "Verplaats omhoog",
                icon: "arrow-up",
                action: () => {
                    up()
                    return true;
                }
            }),
            new ContextMenuItem({
                name: "Verplaats omlaag",
                icon: "arrow-down",
                action: () => {
                    down()
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
                            disabled: !grandParentCategory.value,
                            action: () => {
                                moveTo(grandParentCategory.value!)
                                return true
                            }
                        })
                    ],
                    subCategories.value.map(cat => 
                        new ContextMenuItem({
                            name: cat.settings.name,
                            disabled: cat.groupIds.length > 0,
                            action: () => {
                                moveTo(cat)
                                return true
                            }
                        })
                    )
                ])
            }),
            new ContextMenuItem({
                name: "Verwijder en verplaats inhoud naar",
                disabled: props.category.groupIds.length == 0 && props.category.categoryIds.length == 0,
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: grandParentCategory.value ? parentCategory.value.settings.name : "Hoofdcategorie",
                            disabled: mergeDisabledWith(parentCategory.value),
                            action: () => {
                                mergeWith(parentCategory.value)
                                return true
                            }
                        })
                    ],
                    subCategories.value.map(cat => 
                        new ContextMenuItem({
                            name: cat.settings.name,
                            disabled: mergeDisabledWith(cat),
                            action: () => {
                                mergeWith(cat)
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
                    deleteMe();
                    return true;
                }
            }),
        ]
    ])
    await menu.show({ clickEvent: event })
}
</script>

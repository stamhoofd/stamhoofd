<template>
    <div class="st-view background category-view">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop">
            <template slot="right">
                <button v-if="canEdit" class="navigation button icon settings" type="button" @click="editMe" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons" :class="{button: !!parentCategories.length}" @click="openCategorySelector">
                {{ title }}
                <span v-if="!isPublic" v-tooltip="'Deze categorie is enkel zichtbaar voor beheerders (leden die geen beheerder zijn kunnen zichtzelf niet inschrijven). Je kan dit aanpassen bij de instellingen van deze categorie.'" class="icon lock small" />
                <span v-if="parentCategories.length" class="button icon arrow-swap" />
            </h1>

            <p v-if="organization.isCategoryDeactivated(category)" class="error-box">
                Deze categorie is niet zichtbaar voor leden omdat jouw vereniging nog het oude gratis ledenadministratie pakket gebruikt. Er kan dan maar één categorie in gebruik zijn. Via instellingen kunnen hoofdbeheerders overschakelen op de betaalde versie met meer functionaliteiten.
            </p>
          
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="categories.length > 0">
                <STList>
                    <STListItem v-if="categories.length > 1" :selectable="true" class="left-center" @click="openAll(true)">
                        <span slot="left" class="icon group" />

                        <h2 class="style-title-list bolder">
                            Alle leden
                        </h2>
                        <p class="style-description-small">
                            Bekijk alle leden samen
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem v-if="categories.length > 1 && hasMultipleWaitingLists" :selectable="true" class="left-center" @click="openWaitingList(true)">
                        <span slot="left" class="icon clock" />

                        <h2 class="style-title-list bolder">
                            Gemeenschappelijke wachtlijsten
                        </h2>
                        <p class="style-description-small">
                            Bekijk alle wachtlijsten samen
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem v-for="category in categories" :key="category.id" :selectable="true" @click="openCategory(category)">
                        <template slot="left">
                            <span v-if="category.categories.length" class="icon category" />
                            <span v-else class="icon category" />
                        </template>

                        {{ category.settings.name }}

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-else-if="groups.length > 0">
                <STList>
                    <STListItem v-if="groups.length > 1" :selectable="true" class="left-center" @click="openAll(true)">
                        <span slot="left" class="icon group" />

                        <h2 class="style-title-list bolder">
                            Alle leden
                        </h2>
                        <span v-if="getMemberCount() !== null" slot="right" class="style-description-small">{{ getMemberCount() }}</span>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem v-if="hasMultipleWaitingLists" :selectable="true" class="left-center" @click="openWaitingList(true)">
                        <span slot="left" class="icon clock" />

                        <h2 class="style-title-list bolder">
                            Gemeenschappelijke wachtlijsten
                        </h2>
                        <span v-if="getMemberCount({waitingList: true}) !== null" slot="right" class="style-description-small">{{ getMemberCount({waitingList: true}) }}</span>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                    
                    <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                        <GroupAvatar slot="left" :group="group" />
                        <h3 class="style-title-list">
                            {{ group.settings.name }}
                        </h3>
                        <p v-if="false" class="style-description-small">
                            {{ group.settings.dateRangeDescription }}
                        </p>

                        <template slot="right">
                            <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ group.getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <p v-if="canCreate" class="style-button-bar">
                    <button class="button text" type="button" @click="createGroup">
                        <span class="icon add" />
                        <span>Inschrijvingsgroep</span>
                    </button>
                </p>

                <template v-if="groups.length > 1 && cycleOffsets.length > 0">
                    <hr>
                    <h2>Vorige periodes</h2>
                    <STList class="illustration-list">
                        <STListItem v-for="offset in cycleOffsets" :key="'offset-' + offset" :selectable="true" class="left-center" @click="openAll(true, offset)">
                            <img slot="left" src="@stamhoofd/assets/images/illustrations/package-members.svg">
                            <h2 v-if="offset === 1" class="style-title-list">
                                Vorige inschrijvingsperiode
                            </h2>
                            <h2 v-else class="style-title-list">
                                {{ offset }} inschrijvingsperiodes geleden
                            </h2>

                            <p class="style-description">
                                {{ getTimeRangeOffset(offset) }}
                            </p>

                            <span v-if="getMemberCount({cycleOffset: offset}) !== null" slot="right" class="style-description-small">{{ getMemberCount({cycleOffset: offset}) }}</span>
                            <span slot="right" class="icon arrow-right-small gray" />
                        </STListItem>
                    </STList>
                </template>
            </template>

            <p v-if="categories.length == 0 && groups.length == 0 && canCreate" class="info-box">
                Deze inschrijvingscategorie is leeg, maak zelf inschrijvingsgroepen aan waarin leden kunnen inschrijven.
            </p>
            <p v-else-if="categories.length == 0 && groups.length == 0" class="info-box">
                Deze inschrijvingscategorie is leeg. Vraag een hoofdbeheerder om groepen aan te maken.
            </p>

            <p v-if="categories.length == 0 && groups.length == 0 && canCreate">
                <button class="button text" type="button" @click="createGroup">
                    <span class="icon add" />
                    <span>Nieuwe groep</span>
                </button>
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ContextMenu, ContextMenuItem, ErrorBox, GroupAvatar, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryTree, GroupGenderType, GroupPrivateSettings, GroupSettings, GroupStatus, Organization, OrganizationGenderType, OrganizationMetaData } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";


import EditGroupGeneralView from "./edit/EditGroupGeneralView.vue";
import EditCategoryGroupsView from "./EditCategoryGroupsView.vue";
import GroupMembersView from "./GroupMembersView.vue";
import GroupOverview from "./GroupOverview.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        BackButton,
        GroupAvatar
    },
})
export default class CategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop({ required: true })
        category: GroupCategory

    mounted() {
        UrlHelper.setUrl("/category/"+Formatter.slug(this.category.settings.name))    
        document.title = "Stamhoofd - "+ this.category.settings.name
    }

    get parentCategories() {
        return [
            ...(!this.isRoot && this.organization.meta.rootCategory ? [this.organization.meta.rootCategory] : []),
            ...this.category.getParentCategories(this.organization.availableCategories),
        ]
    }

    get isPublic() {
        return this.tree.isPublic(this.organization.availableCategories)
    }

    openCategorySelector(event) {
        if (this.parentCategories.length === 0) {
            return
        }

        const actions: ContextMenuItem[] = [];

        for (const parent of this.parentCategories) {
            actions.unshift(new ContextMenuItem({
                name: parent.id === this.organization.meta.rootCategoryId ? 'Alle inschrijvingsgroepen' : parent.settings.name,
                icon: 'category',
                action: () => {
                    this.swapCategory(parent)
                    return true;
                }
            }));
        }
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: this.title,
                    icon: 'category',
                    disabled: true,
                    action: () => {
                        return true;
                    }
                }),
                ...actions
            ]
        ])
        menu.show({ clickEvent: event, xPlacement: "right", yPlacement: "bottom" }).catch(console.error)
    }

    swapCategory(category: GroupCategory) {
        this.show({
            components: [new ComponentWithProperties(CategoryView, {
                category
            })],
            replace: this.navigationController?.components?.length ?? 1,
            animated: false
        })
    }

    get cycleOffsets() {
        const l = Math.max(...this.groups.map(g => g.cycle));
        const arr = new Array(l)
        for (let i = 0; i < l; i++) {
            arr[i] = i+1
        }

        // Remove last ones if no members in it
        for (let i = l - 1; i >= 0; i--) {
            if (this.getMemberCount({cycleOffset: i + 1}) === 0) {
                arr.pop()
            } else {
                break
            }
        }
        return arr;
    }

    getTimeRangeOffset(offset: number) {
        for (const group of this.groups) {
            const str = group.getTimeRangeOffset(offset)
            if (str) {
                return str
            }
        }
        return null
    }

    get reactiveCategory() {
        const c = this.organization.meta.categories.find(c => c.id === this.category.id)
        if (c) {
            return c
        }
        return this.category
    }

    getMemberCount({cycleOffset, waitingList}: {cycleOffset?: number, waitingList?: boolean} = {}) {
        return this.tree.getMemberCount({cycleOffset, waitingList})
    }

    get hasMultipleWaitingLists() {
        let c = 0;
        for (const group of this.tree.getAllGroups()) {
            if (group.settings.canHaveWaitingListWithoutMax || group.getMemberCount({waitingList: true}) !== 0) {
                c += 1;
                if (c > 1) {
                    return true
                }
            }
        }
        return false
    }

    get tree() {
        return GroupCategoryTree.build(this.reactiveCategory, this.organization, {permissions: this.$organizationManager.user.permissions})
    }

    get organization() {
        return this.$organization
    }

    get isRoot() {
        return this.category.id === this.organization.meta.rootCategoryId
    }

    get title() {
        return this.isRoot ? 'Alle inschrijvingsgroepen' : this.name+''
    }

    get name() {
        return this.reactiveCategory.settings.name
    }

    get canEdit() {
        return this.$organizationManager.user.permissions ? this.category.canEdit(this.$organizationManager.user.permissions, this.organization.privateMeta?.roles ?? []) : false
    }

    get canCreate() {
        return this.$organizationManager.user.permissions ? this.category.canCreate(this.$organizationManager.user.permissions, this.organization.meta.categories, this.organization.privateMeta?.roles ?? []) : false
    }

    get groups() {
        return this.tree.groups
    }

    get categories() {
        return this.tree.categories
    }

    openCategory(category: GroupCategory) {
        this.show(new ComponentWithProperties(CategoryView, {
            category
        }))
    }

    openGroup(group: Group) {
        this.show(new ComponentWithProperties(GroupOverview, {
            group
        }))
    }

    openAll(animated = true, cycleOffset?: number) {
        this.show({
            components: [
                new ComponentWithProperties(GroupMembersView, {
                    category: this.tree,
                    initialCycleOffset: cycleOffset
                })
            ],
            animated
        })
    }

    openWaitingList(animated = true) {
        this.show({
            components: [
                new ComponentWithProperties(GroupMembersView, {
                    category: this.tree,
                    waitingList: true
                })
            ],
            animated
        })
    }

    createGroup() {
        const group = Group.create({
            settings: GroupSettings.create({
                name: "",
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: [],
                genderType: this.organization.meta.genderType == OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale
            }),
            privateSettings: GroupPrivateSettings.create({})
        })
        const meta = OrganizationMetaData.patch({})

        const me = GroupCategory.patch({ id: this.category.id })
        me.groupIds.addPut(group.id)
        meta.categories.addPatch(me)

        const p = Organization.patch({
            id: this.organization.id,
            meta
        })

        p.groups.addPut(group)
        
        this.present(new ComponentWithProperties(EditGroupGeneralView, { 
            group, 
            organization: this.organization.patch(p), 
            saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                await this.$organizationManager.patch(p.patch(patch))
            }
        }).setDisplayStyle("popup"))
    }

    editMe() {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(EditCategoryGroupsView, { 
                category: this.category, 
                organization: this.organization, 
                saveHandler: async (patch) => {
                    patch.id = this.organization.id
                    await this.$organizationManager.patch(patch)
                }
            })
        }).setDisplayStyle("popup"))
    }
    
}
</script>

<style lang="scss">
    .category-view {
        --block-width: 24px;
    }
</style>
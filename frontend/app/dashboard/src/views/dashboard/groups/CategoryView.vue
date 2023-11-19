<template>
    <div class="st-view background">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop">
            <template slot="right">
                <button v-if="canEdit" class="button text" type="button" @click="editMe">
                    <span class="icon settings" />
                    <span>Instellingen</span>
                </button>
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>

            <p v-if="organization.isCategoryDeactivated(category)" class="error-box">
                Deze categorie is niet zichtbaar voor leden omdat het activiteiten pakket niet is geactiveerd. Er kan dan maar één categorie in gebruik zijn. Via instellingen kunnen hoofdbeheerders pakketten activeren.
            </p>
          
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="categories.length > 0">
                <STList>
                    <STListItem v-for="category in categories" :key="category.id" :selectable="true" @click="openCategory(category)">
                        {{ category.settings.name }}

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-else-if="groups.length > 0">
                <STList>
                    <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                        <GroupAvatar slot="left" :group="group" />
                        <h3 class="style-title-list">
                            {{ group.settings.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ group.settings.dateRangeDescription }}
                        </p>

                        <template slot="right">
                            <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ group.getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <p v-if="canCreate">
                    <button class="button text" type="button" @click="createGroup">
                        <span class="icon add" />
                        <span>Nieuwe groep toevoegen</span>
                    </button>
                </p>

                <template v-if="groups.length > 1">
                    <hr>
                    <h2>Alle leden</h2>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center" @click="openAll(true)">
                            <img slot="left" src="~@stamhoofd/assets/images/illustrations/group.svg">

                            <h2 class="style-title-list">
                                Inschrijvingen ({{ category.settings.name }})
                            </h2>
                            <p class="style-description">
                                Bekijk, beheer, exporteer, e-mail of SMS alle leden samen.
                            </p>
                            <span v-if="getMemberCount() !== null" slot="right" class="style-description-small">{{ getMemberCount() }}</span>
                            <span slot="right" class="icon arrow-right-small gray" />
                        </STListItem>

                        <STListItem v-for="offset in cycleOffsets" :key="'offset-' + offset" :selectable="true" class="left-center" @click="openAll(true, offset)">
                            <img slot="left" src="~@stamhoofd/assets/images/illustrations/package-members.svg">
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

                        <STListItem v-if="(getMemberCount({waitingList: true}) !== 0) || canHaveWaitingList" :selectable="true" class="left-center" @click="openWaitingList(true)">
                            <img slot="left" src="~@stamhoofd/assets/images/illustrations/clock.svg">
                            <h2 class="style-title-list">
                                Wachtlijst
                            </h2>
                            <p class="style-description">
                                Bekijk leden op de wachtlijst.
                            </p>
                            <span v-if="getMemberCount({waitingList: true}) !== null" slot="right" class="style-description-small">{{ getMemberCount({waitingList: true}) }}</span>
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
                    <span>Nieuwe groep toevoegen</span>
                </button>
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox, GroupAvatar, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryTree, GroupGenderType, GroupPrivateSettings, GroupSettings, GroupStatus, Organization, OrganizationGenderType, OrganizationMetaData } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
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
        if (this.groups.length == 0) {
            return null
        }

        let count = 0
        for (const group of this.groups) {
            const c = group.getMemberCount({cycleOffset, waitingList});
            if (c === null) {
                if (cycleOffset && group.cycle < cycleOffset) {
                    // This group did not have active registrations at the time
                    continue
                }
                return null
            }
            count += c
        }
        return count
    }

    get canHaveWaitingList() {
        for (const group of this.groups) {
            if (group.settings.canHaveWaitingList) {
                return true
            }
        }
        return false
    }

    get tree() {
        return GroupCategoryTree.build(this.reactiveCategory, this.organization.meta.categories, this.organization.groups, OrganizationManager.user.permissions)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get isRoot() {
        return this.category.id === this.organization.meta.rootCategoryId
    }

    get title() {
        return this.isRoot ? 'Inschrijvingsgroepen' : this.name+''
    }

    get name() {
        return this.reactiveCategory.settings.name
    }

    get canEdit() {
        return OrganizationManager.user.permissions ? this.category.canEdit(OrganizationManager.user.permissions) : false
    }

    get canCreate() {
        return OrganizationManager.user.permissions ? this.category.canCreate(OrganizationManager.user.permissions, this.organization.meta.categories) : false
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
                await OrganizationManager.patch(p.patch(patch))
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
                    await OrganizationManager.patch(patch)
                }
            })
        }).setDisplayStyle("popup"))
    }
    
}
</script>

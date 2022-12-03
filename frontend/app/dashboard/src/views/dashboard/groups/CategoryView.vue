<template>
    <div class="st-view background">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop">
            <template slot="right">
                <button v-if="canEdit" class="button text" @click="editMe">
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
                    <STListItem v-if="groups.length > 1" :selectable="true" @click="openAll()">
                        <span slot="left" class="icon group" />
                        Alle leden

                        <template slot="right">
                            <span v-if="totalCount !== null" class="style-description-small">{{ totalCount }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                    <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                        <GroupAvatar slot="left" :group="group" />
                        <h3 class="style-title-list">
                            {{ group.settings.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ group.settings.dateRangeDescription }}
                        </p>

                        <template slot="right">
                            <span v-if="group.settings.registeredMembers !== null" class="style-description-small">{{ group.settings.registeredMembers }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <p v-if="categories.length == 0 && groups.length == 0 && canCreate" class="info-box">
                Deze inschrijvingscategorie is leeg, maak zelf inschrijvingsgroepen aan waarin leden kunnen inschrijven.
            </p>
            <p v-else-if="categories.length == 0 && groups.length == 0" class="info-box">
                Deze inschrijvingscategorie is leeg. Vraag een hoofdbeheerder om groepen aan te maken.
            </p>

            <p v-if="categories.length == 0 && canCreate">
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
import { BackButton,ErrorBox, GroupAvatar,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryTree, GroupGenderType, GroupPrivateSettings, GroupSettings, Organization, OrganizationGenderType, OrganizationMetaData } from "@stamhoofd/structures"
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import EditCategoryGroupsView from "./EditCategoryGroupsView.vue";
import EditGroupView from "./EditGroupView.vue";
import GroupMembersView from "./GroupMembersView.vue";

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

    get reactiveCategory() {
        const c = this.organization.meta.categories.find(c => c.id === this.category.id)
        if (c) {
            return c
        }
        return this.category
    }

    get totalCount() {
        if (this.groups.length == 0) {
            return null
        }

        let count = 0
        for (const group of this.groups) {
            if (group.settings.registeredMembers === null) {
                return null
            }
            count += group.settings.registeredMembers
        }
        return count
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
        this.show(new ComponentWithProperties(GroupMembersView, {
            group
        }))
    }

    openAll() {
        this.show(new ComponentWithProperties(GroupMembersView, {
            category: this.tree
        }))
    }

    createGroup() {
        const group = Group.create({
            settings: GroupSettings.create({
                name: "",
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
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
        
        this.present(new ComponentWithProperties(EditGroupView, { 
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

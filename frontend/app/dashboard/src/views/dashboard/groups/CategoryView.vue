<template>
    <div class="st-view background category-view">
        <STNavigationBar :title="title">
            <template #right>
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
                        <template #left><span class="icon group" /></template>

                        <h2 class="style-title-list bolder">
                            Alle leden
                        </h2>
                        <p class="style-description-small">
                            Bekijk alle leden samen
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-if="categories.length > 1 && hasMultipleWaitingLists" :selectable="true" class="left-center" @click="openWaitingList(true)">
                        <template #left><span class="icon clock" /></template>

                        <h2 class="style-title-list bolder">
                            Gemeenschappelijke wachtlijsten
                        </h2>
                        <p class="style-description-small">
                            Bekijk alle wachtlijsten samen
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-for="category in categories" :key="category.id" :selectable="true" @click="openCategory(category)">
                        <template #left>
                            <span v-if="category.categories.length" class="icon category" />
                            <span v-else class="icon category" />
                        </template>

                        {{ category.settings.name }}

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-else-if="groups.length > 0">
                <STList>
                    <STListItem v-if="groups.length > 1" :selectable="true" class="left-center" @click="openAll(true)">
                        <template #left><span class="icon group" /></template>

                        <h2 class="style-title-list bolder">
                            Alle leden
                        </h2>
                        <template #right><span v-if="getMemberCount() !== null" class="style-description-small">{{ getMemberCount() }}</span>
                        <span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-if="hasMultipleWaitingLists" :selectable="true" class="left-center" @click="openWaitingList(true)">
                        <template #left><span class="icon clock" /></template>

                        <h2 class="style-title-list bolder">
                            Gemeenschappelijke wachtlijsten
                        </h2>
                        <template #right><span v-if="getMemberCount({waitingList: true}) !== null" class="style-description-small">{{ getMemberCount({waitingList: true}) }}</span>
                        <span class="icon arrow-right-small gray" /></template>
                    </STListItem>
                    
                    <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                        <template #left><GroupAvatar :group="group" /></template>
                        <h3 class="style-title-list">
                            {{ group.settings.name }}
                        </h3>
                        <template #right>
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
import { BackButton, ContextMenu, ContextMenuItem, ErrorBox, GroupAvatar, MembersTableView, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryTree, GroupGenderType, GroupPrivateSettings, GroupSettings, GroupStatus, Organization, OrganizationGenderType, OrganizationMetaData, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import EditGroupGeneralView from "./edit/EditGroupGeneralView.vue";
import EditCategoryGroupsView from "./EditCategoryGroupsView.vue";
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

    @Prop({ required: true })
        period: OrganizationRegistrationPeriod

    mounted() {
        UrlHelper.setUrl("/category/"+Formatter.slug(this.category.settings.name))    
        document.title = "Stamhoofd - "+ this.category.settings.name
    }

    get parentCategories() {
        return [
            ...(!this.isRoot && this.period.settings.rootCategory ? [this.period.settings.rootCategory] : []),
            ...this.category.getParentCategories(this.period.availableCategories),
        ]
    }

    get isPublic() {
        return this.tree.isPublic(this.period.availableCategories)
    }

    openCategorySelector(event: MouseEvent) {
        if (this.parentCategories.length === 0) {
            return
        }

        const actions: ContextMenuItem[] = [];

        for (const parent of this.parentCategories) {
            actions.unshift(new ContextMenuItem({
                name: parent.id === this.period.settings.rootCategoryId ? 'Alle inschrijvingsgroepen' : parent.settings.name,
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
                category,
                period: this.period
            })],
            replace: this.navigationController?.components?.length ?? 1,
            animated: false
        })
    }

    get reactiveCategory() {
        const c = this.period.settings.categories.find(c => c.id === this.category.id)
        if (c) {
            return c
        }
        return this.category
    }

    getMemberCount({waitingList}: {waitingList?: boolean} = {}) {
        return this.tree.getMemberCount({waitingList})
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
        return GroupCategoryTree.build(this.reactiveCategory, this.period, {permissions: this.$context.auth.permissions})
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
        return this.$organizationManager.user.permissions ? this.category.canEdit(this.$context.auth.permissions) : false
    }

    get canCreate() {
        return this.$organizationManager.user.permissions ? this.category.canCreate(this.$context.auth.permissions, this.organization.period.settings.categories) : false
    }

    get groups() {
        return this.tree.groups
    }

    get categories() {
        return this.tree.categories
    }

    openCategory(category: GroupCategory) {
        this.show(new ComponentWithProperties(CategoryView, {
            category,
            period: this.period
        }))
    }

    openGroup(group: Group) {
        this.show(new ComponentWithProperties(GroupOverview, {
            group,
            period: this.period
        }))
    }

    openAll(animated = true, cycleOffset?: number) {
        this.show({
            components: [
                new ComponentWithProperties(MembersTableView, {
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
                new ComponentWithProperties(MembersTableView, {
                    category: this.tree,
                    waitingList: true
                })
            ],
            animated
        })
    }

    createGroup() {
        const group = Group.create({
            organizationId: this.organization.id,
            periodId: this.period.period.id,
            settings: GroupSettings.create({
                name: "",
                startDate: new Date(),
                endDate: new Date(),
                prices: [],
                genderType: this.organization.meta.genderType == OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale
            }),
            privateSettings: GroupPrivateSettings.create({})
        })
        const settings = OrganizationRegistrationPeriodSettings.patch({})

        const me = GroupCategory.patch({ id: this.category.id })
        me.groupIds.addPut(group.id)
        settings.categories.addPatch(me)

        const p = OrganizationRegistrationPeriod.patch({
            id: this.period.id,
            settings
        })
        p.groups.addPut(group)
        
        this.present(new ComponentWithProperties(EditGroupGeneralView, { 
            group, 
            organization: this.organization.patch(p), 
            saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                const merged = p.patch(patch)
                await this.$organizationManager.patchPeriod(merged)
            }
        }).setDisplayStyle("popup"))
    }

    editMe() {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(EditCategoryGroupsView, { 
                category: this.category, 
                period: this.period,
                organization: this.organization, 
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    patch.id = this.period.id
                    await this.$organizationManager.patchPeriod(patch)
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

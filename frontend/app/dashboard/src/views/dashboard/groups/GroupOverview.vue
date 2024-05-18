<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title" />

        <main>
            <h1 class="style-navigation-title with-icons button" @click="openCategorySelector">
                <span>{{ title }}</span>
                
                <span v-if="!isPublic" v-tooltip="'Deze groep staat in een categorie die enkel zichtbaar is voor beheerders'" class="icon lock small" />
                <template v-else>
                    <span v-if="isArchive" key="archive" class="icon archive" />
                    <span v-else-if="isOpen" key="open" v-tooltip="'Inschrijven is mogelijk via het ledenportaal'" class="icon dot green" />
                    <span v-else key="closed" v-tooltip="'Inschrijvingen zijn gesloten'" class="icon dot red" />
                </template>
                <span v-if="parentCategories.length" class="button icon arrow-swap" />
            </h1>

            <BillingWarningBox filter-types="members" class="data-table-prefix" />

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openMembers(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 v-if="group.cycle > 0" class="style-title-list">
                        Inschrijvingen
                    </h2>
                    <h2 v-else class="style-title-list">
                        Inschrijvingen
                    </h2>
                    <p v-if="group.cycle > 0" class="style-description">
                        {{ group.settings.dateRangeDescription }}
                    </p>
                    <p v-else class="style-description">
                        Bekijk, beheer, exporteer, e-mail of SMS leden.
                    </p>
                    <template #right>
                        <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ group.getMemberCount() }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="(group.settings.waitingListSize && group.settings.waitingListSize > 0) || group.settings.canHaveWaitingListWithoutMax" :selectable="true" class="left-center" @click="openWaitingList(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/clock.svg">
                    </template>
                    <h2 class="style-title-list">
                        Wachtlijst
                    </h2>
                    <p class="style-description">
                        Bekijk leden op de wachtlijst.
                    </p>
                    <template #right>
                        <span v-if="group.settings.waitingListSize !== null" class="style-description-small">{{ group.settings.waitingListSize }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-for="offset in limitedCycleOffsets" :key="'offset-' + offset" :selectable="true" class="left-center" @click="openMembers(true, offset)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/package-members.svg">
                    </template>
                    <h2 v-if="offset === 1" class="style-title-list">
                        Vorige inschrijvingsperiode
                    </h2>
                    <h2 v-else class="style-title-list">
                        {{ offset }} inschrijvingsperiodes geleden
                    </h2>

                    <p class="style-description">
                        {{ group.getTimeRangeOffset(offset) }}
                    </p>

                    <template #right>
                        <span v-if="group.getMemberCount({cycleOffset: offset}) !== null" class="style-description-small">{{ group.getMemberCount({cycleOffset: offset}) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <button v-if="hasMoreCycleOffsets && !showAllCycleOffsets" type="button" class="button text" @click="doShowAllCycleOffsets">
                <span>Toon vorige periodes</span>
            </button>

            <template v-if="hasFullPermissions">
                <hr>
                <h2>Instellingen</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                        </template>
                        <h2 class="style-title-list">
                            Algemeen
                        </h2>
                        <p class="style-description">
                            Naam en periode
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPrices(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/piggy-bank.svg">
                        </template>
                        <h2 class="style-title-list">
                            Prijs
                        </h2>
                        <p class="style-description">
                            Wijzig de inschrijvingsprijs en eventuele kortingen
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editRestrictions(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/account.svg">
                        </template>
                        <h2 class="style-title-list">
                            Inschrijvingsbeperkingen
                        </h2>
                        <p class="style-description">
                            Pas aan wie kan inschrijven
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editWaitinglist(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/clock.svg">
                        </template>
                        <h2 class="style-title-list">
                            Wachtlijst, voorinschrijvingen en limieten
                        </h2>
                        <p class="style-description">
                            Stel het maximum aantal leden in of schakel de wachtlijst in
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>


                    <STListItem :selectable="true" class="left-center" @click="editPermissions(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                        </template>
                        <h2 class="style-title-list">
                            Toegangsbeheer
                        </h2>
                        <p class="style-description">
                            Bepaal wie leden en instellingen van deze groep kan bekijken of wijzigen
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr>
                <h2>Personaliseren</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                        </template>
                        <h2 class="style-title-list">
                            Beschrijving, locatie en foto's
                        </h2>
                        <p class="style-description">
                            Wijzig de informatie die zichtbaar is op het ledenportaal.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editEmails(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/email.svg">
                        </template>
                        <h2 class="style-title-list">
                            E-mails
                        </h2>
                        <p class="style-description">
                            Wijzig de inhoud van automatische e-mails naar leden.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr>
                <h2>Acties</h2>

                <STList>
                    <STListItem v-if="!isArchive && !isOpen" :selectable="true" @click="openGroup()">
                        <h2 class="style-title-list">
                            Inschrijvingen openen
                        </h2>
                        <p class="style-description">
                            Open inschrijvingen van leden via het ledenportaal.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary green hide-smartphone">
                                <span class="icon power" />
                                <span>Open</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isArchive && isOpen" :selectable="true" @click="closeGroup()">
                        <h2 class="style-title-list">
                            Inschrijvingen sluiten
                        </h2>
                        <p class="style-description">
                            Stop inschrijvingen van leden via het ledenportaal. Na het sluiten van de inschrijvingen kan je de groep ook eventueel archiveren.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon power" />
                                <span>Sluiten</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="restoreGroup($event)">
                        <h2 class="style-title-list">
                            Terughalen uit archief
                        </h2>
                        <p class="style-description">
                            Zet de inschrijvingsgroep terug.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon undo" />
                                <span>Terugzetten</span>
                            </button>
                            <button type="button" class="button icon undo only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="hasMembers && !isArchive" :selectable="true" @click="newPeriod()">
                        <h2 class="style-title-list">
                            Nieuwe inschrijvingsperiode
                        </h2>
                        <p class="style-description">
                            Maak de lijst met ingeschreven leden terug leeg, maar maak het mogelijk om de lijst van de vorige leden nog te raadplegen. Ideaal voor groepen die elk jaar opnieuw inschrijven.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon reverse" />
                                <span>Nieuw</span>
                            </button>
                            <button type="button" class="button icon reverse only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!hasMembers && cycleOffsets.length && !isArchive" @click="undoPeriod()">
                        <h2 class="style-title-list">
                            Inschrijvingsperiode ongedaan maken
                        </h2>
                        <p class="style-description">
                            Keer terug naar de vorige inschrijvingsperiode.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon undo" />
                                <span>Terug</span>
                            </button>
                            <button type="button" class="button icon undo only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="archiveGroup()">
                        <h2 class="style-title-list">
                            Groep archiveren
                        </h2>
                        <p class="style-description">
                            Verplaats de groep naar het archief, maar behoud alle gegevens zodat je ze later nog kan raadplegen. 
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon archive" />
                                <span>Archiveren</span>
                            </button>
                            <button type="button" class="button icon archive only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="deleteGroup()">
                        <h2 class="style-title-list">
                            Groep definitief verwijderen
                        </h2>
                        <p class="style-description">
                            Verwijder deze groep en alle daarbij horende informatie. Dit is meestal niet nodig.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash" />
                                <span>Verwijderen</span>
                            </button>
                            <button type="button" class="button icon trash only-smartphone" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { BackButton, CenteredMessage, ContextMenu, ContextMenuItem, EditResourceRolesView, PromiseView, STList, STListItem, STNavigationBar, Toast, TooltipDirective, MembersTableView } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryTree, GroupSettings, GroupStatus, Organization, OrganizationMetaData, PermissionsResourceType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import BillingWarningBox from '../settings/packages/BillingWarningBox.vue';
import CategoryView from './CategoryView.vue';
import EditGroupEmailsView from './edit/EditGroupEmailsView.vue';
import EditGroupGeneralView from './edit/EditGroupGeneralView.vue';
import EditGroupPageView from './edit/EditGroupPageView.vue';
import EditGroupPricesView from './edit/EditGroupPricesView.vue';
import EditGroupRestrictionsView from './edit/EditGroupRestrictionsView.vue';
import EditGroupWaitinglistView from './edit/EditGroupWaitinglistView.vue';
import GroupNewPeriodView from './edit/GroupNewPeriodView.vue';
import GroupMembersView from './GroupMembersView.vue';

@Component({
    components: {
        STNavigationBar,
        BackButton,
        STList,
        STListItem,
        BillingWarningBox
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class GroupOverview extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        group!: Group;

    showAllCycleOffsets = false;

    doShowAllCycleOffsets() {
        this.showAllCycleOffsets = true
    }

    get isStamhoofd() {
        return this.$organizationManager.user.email.endsWith("@stamhoofd.be") || this.$organizationManager.user.email.endsWith("@stamhoofd.nl")
    }

    get isPublic() {
        return this.group.isPublic(this.organization.availableCategories)
    }

    get hasMembers() {
        return !!this.group.settings.registeredMembers
    }
    
    get hasMoreCycleOffsets() {
        return this.cycleOffsets.length > 0
    }

    get cycleOffsets() {
        const minimumCycle = Math.min(0, ...this.group.settings.cycleSettings.keys())

        const arr: number[] = []
        for (let i = 0; i < this.group.cycle - minimumCycle; i++) {
            arr.push(i + 1)
        }
        return arr;
    }

    get limitedCycleOffsets() {
        if (this.showAllCycleOffsets) {
            return this.cycleOffsets
        }
        return []
    }

    get organization() {
        return this.$organization
    }

    get title() {
        return this.group.settings.name
    }

    get isArchive() {
        return this.group.status === GroupStatus.Archived;
    }

    get isOpen() {
        return !this.group.closed
    }

    get hasFullPermissions() {
        return this.group.hasFullAccess(this.$context.organizationPermissions, this.organization)
    }

    get hasWritePermissions() {
        return this.group.hasWriteAccess(this.$context.organizationPermissions, this.organization)
    }
   
    openMembers(animated = true, cycleOffset = 0) {
        this.show({
            animated,
            adjustHistory: animated,
            components: [
                new ComponentWithProperties(MembersTableView, {
                    group: this.group,
                    initialCycleOffset: cycleOffset
                })
            ]
        })
    }

    openWaitingList(animated = true) {
        this.show({
            animated,
            adjustHistory: animated,
            components: [
                new ComponentWithProperties(GroupMembersView, {
                    group: this.group,
                    waitingList: true
                })
            ]
        })
    }

    editGeneral(animated = true) {
        this.displayEditComponent(EditGroupGeneralView, animated)
    }

    editRestrictions(animated = true) {
        this.displayEditComponent(EditGroupRestrictionsView, animated)
    }

    editPrices(animated = true) {
        this.displayEditComponent(EditGroupPricesView, animated)
    }

    editWaitinglist(animated = true) {
        this.displayEditComponent(EditGroupWaitinglistView, animated)
    }

    editPermissions(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(EditResourceRolesView, {
                    description: 'Kies hier welke beheerdersrollen deze inschrijvingsgroep kunnen bekijken, bewerken of beheren.',
                    resource: {
                        id: this.group.id,
                        name: this.group.settings.name,
                        type: PermissionsResourceType.Groups
                    },
                    configurableAccessRights: []
                })
            ]
        });
    }

    editPage(animated = true) {
        this.displayEditComponent(EditGroupPageView, animated)
    }

    editEmails(animated = true) {
        this.displayEditComponent(EditGroupEmailsView, animated)
    }

    displayEditComponent(component, animated = true) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    try {
                        // Make sure we have an up to date group
                        await this.$organizationManager.forceUpdate()
                        return new ComponentWithProperties(component, {
                            group: this.group, 
                            organization: this.$organization, 
                            saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                                patch.id = this.$organization.id
                                await this.$organizationManager.patch(patch)
                            }
                        })
                    } catch (e) {
                        Toast.fromError(e).show()
                        throw e
                    }
                }
            })
        })

        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                displayedComponent
            ]
        });
    }

    mounted() {
        const parts = UrlHelper.shared.getParts()
        //const params = UrlHelper.shared.getSearchParams()

        // Set url
        UrlHelper.setUrl("/groups/"+Formatter.slug(this.group.settings.name))
        document.title = "Stamhoofd - "+this.group.settings.name

        if (parts.length == 3 && parts[0] == 'groups' && parts[2] == 'members') {
            this.openMembers(false)
        }

        if (parts.length == 3 && parts[0] == 'groups' && parts[2] == 'waiting-list') {
            this.openWaitingList(false)
        }
    }

    get parentCategories() {
        return [
            ...(this.organization.meta.rootCategory ? [this.organization.meta.rootCategory] : []),
            ...this.group.getParentCategories(this.organization.availableCategories),
        ]
    }

    openCategorySelector(event) {
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
                    icon: 'group',
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

    beforeUnmount() {
        // Clear all pending requests
        Request.cancelAll(this)
    }

    async openGroup() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je de inschrijvingen wilt openen?", "Ja, openen")) {
            return;
        }

        try {
            const patch = Organization.patch({
                id: this.$organization.id
            })
            const p = Group.patch({
                id: this.group.id,
                status: GroupStatus.Open
            });

            if (this.group.settings.registrationStartDate && this.group.settings.registrationStartDate.getTime() > Date.now()) {
                p.settings = GroupSettings.patch({
                    registrationStartDate: null
                })
            }

            if (this.group.settings.registrationEndDate && this.group.settings.registrationEndDate.getTime() <= Date.now()) {
                p.settings = GroupSettings.patch({
                    registrationEndDate: null
                })
            }
            patch.groups.addPatch(p)
            await this.$organizationManager.patch(patch)
            new Toast("De inschrijvingen zijn terug open", "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    newPeriod() {
        this.displayEditComponent(GroupNewPeriodView, true)
    }

    async undoPeriod() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je de inschrijvingsperiode wilt ongedaan maken?", "Ja, ongedaan maken")) {
            return;
        }

        try {
            const patch = Organization.patch({
                id: this.$organization.id
            })

            const cycleInformation = this.group.settings.cycleSettings.get(this.group.cycle - 1)
            patch.groups.addPatch(Group.patch({
                id: this.group.id,
                cycle: this.group.cycle - 1,
                settings: GroupSettings.patch({
                    startDate: cycleInformation?.startDate ?? undefined,
                    endDate: cycleInformation?.endDate ?? undefined,
                })
            }))
            await this.$organizationManager.patch(patch)
            new Toast("De inschrijvingsperiode is ongedaan gemaakt", "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async archiveGroup() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze groep wilt archiveren?", "Ja, archiveren")) {
            return;
        }

        try {
            const metaPatch = OrganizationMetaData.patch({})

            for (const category of this.organization.meta.categories) {
                if (category.groupIds.includes(this.group.id)) {
                    const catPatch = GroupCategory.patch({id: category.id})
                    catPatch.groupIds.addDelete(this.group.id)
                    metaPatch.categories.addPatch(catPatch)
                }
            }

            const patch = Organization.patch({
                id: this.$organization.id,
                meta: metaPatch
            })
            patch.groups.addPatch(Group.patch({
                id: this.group.id,
                status: GroupStatus.Archived
            }))

           
            await this.$organizationManager.patch(patch)

            // Force update because the patch won't get the group in the response
            this.group.status = GroupStatus.Archived
            new Toast("De groep is gearchiveerd", "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async deleteGroup() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze groep wilt verwijderen?", "Ja, verwijderen")) {
            return;
        }

        try {
            const metaPatch = OrganizationMetaData.patch({})

            for (const category of this.organization.meta.categories) {
                if (category.groupIds.includes(this.group.id)) {
                    const catPatch = GroupCategory.patch({id: category.id})
                    catPatch.groupIds.addDelete(this.group.id)
                    metaPatch.categories.addPatch(catPatch)
                }
            }

            const patch = Organization.patch({
                id: this.$organization.id,
                meta: metaPatch
            })
            patch.groups.addDelete(this.group.id)
            await this.$organizationManager.patch(patch)
            new Toast("De groep is verwijderd", "success green").show()
            this.pop({force: true})
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    get allCategories() {
        return this.organization.getCategoryTree({admin: true, permissions: this.$context.organizationPermissions}).getAllCategories().filter(c => c.categories.length == 0)
    }

    async restoreGroup(event) {
        if (this.allCategories.length == 1) {
            await this.unarchiveGroupTo(this.group, this.allCategories[0])
            return
        }

        const menu = new ContextMenu([
            this.allCategories.map(cat => 
                new ContextMenuItem({
                    name: cat.settings.name,
                    rightText: cat.groupIds.length+"",
                    action: () => {
                        this.unarchiveGroupTo(this.group, cat).catch(console.error)
                        return true
                    }
                })
            )
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }

    async unarchiveGroupTo(group: Group, cat: GroupCategoryTree) {
        if (!(await CenteredMessage.confirm(`${group.settings.name} terugzetten naar ${cat.settings.name}?`, 'Ja, terugzetten'))) {
            return
        }

        const wasArchive = this.isArchive

        try {
            const metaPatch = OrganizationMetaData.patch({})
            const catPatch = GroupCategory.patch({id: cat.id})

            if (cat.groupIds.filter(id => id == group.id).length > 1) {
                // Not fixable, we need to set the ids manually
                const cleaned = cat.groupIds.filter(id => id != group.id)
                cleaned.push(group.id)
                catPatch.groupIds = cleaned as any
            } else {
                // We need to delete it to fix issues if it is still there
                catPatch.groupIds.addDelete(group.id)
                catPatch.groupIds.addPut(group.id)
            }

            metaPatch.categories.addPatch(catPatch)

            const patch = Organization.patch({
                id: this.organization.id,
                meta: metaPatch
            })

            patch.groups.addPatch(Group.patch({
                id: group.id,
                status: GroupStatus.Closed
            }))

            try {
                await this.$organizationManager.patch(patch)
                // Manually update this group
                const foundGroup = this.$organization.groups.find(g => g.id == group.id)
                if (foundGroup) {
                    // Bit ugly, but only reliable way
                    this.group = foundGroup
                }
            } catch (e) {
                Toast.fromError(e).show()
            }
            new Toast(wasArchive ? "De inschrijvingsgroep is teruggezet" : "De inschrijvingen zijn gesloten", "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async closeGroup() {
        if (!await CenteredMessage.confirm(this.isArchive ? "Ben je zeker dat je de inschrijvingsgroep wilt terugzetten?" : "Ben je zeker dat je de inschrijvingen wilt sluiten?", this.isArchive ?  "Ja, terugzetten" : "Ja, sluiten")) {
            return;
        }

        const wasArchive = this.isArchive

        try {
            const patch = Organization.patch({
                id: this.$organization.id
            })
            patch.groups.addPatch(Group.patch({
                id: this.group.id,
                status: GroupStatus.Closed
            }))
            await this.$organizationManager.patch(patch)
            new Toast(wasArchive ? "De inschrijvingsgroep is teruggezet" : "De inschrijvingen zijn gesloten", "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }
}
</script>

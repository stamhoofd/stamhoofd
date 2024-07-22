<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title" />

        <main>
            <h1 class="style-navigation-title">
                {{ title }}

                <span v-if="period" class="title-suffix">
                    {{ period.period.nameShort }}
                </span>
            </h1>
            <p v-if="isLocked" class="warning-box">
                Dit werkjaar is vergrendeld. Je kan geen wijzigingen meer aanbrengen aan inschrijvingen.
            </p>
            <p v-if="!isPublic" class="info-box">
                Deze groep staat in een categorie die enkel zichtbaar is voor beheerders
            </p>
            <p v-if="!isArchive && !isOpen" class="info-box">
                Inschrijvingen zijn momenteel gesloten via het ledenportaal. Stel een datum in waarop ze moeten openen, of open de inschrijvingen manueel via de knoppen onderaan.
            </p>

            <BillingWarningBox filter-types="members" class="data-table-prefix" />

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openMembers(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 class="style-title-list">
                        Leden
                    </h2>
                    <p class="style-description">
                        Bekijk, beheer, exporteer, e-mail of SMS leden.
                    </p>
                    <template #right>
                        <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ formatInteger(group.getMemberCount()!) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="(group.settings.waitingListSize && group.settings.waitingListSize > 0) || group.settings.canHaveWaitingListWithoutMax" :selectable="true" class="left-center" @click="openMembers(true, {waitingList: true})">
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

                <STListItem :selectable="true" class="left-center" @click="openMembers(true)" v-for="responsibility of linkedResponsibilities" :key="responsibility.id">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/responsibility.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ responsibility.name }}
                    </h2>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

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
                            <img src="@stamhoofd/assets/images/illustrations/email-template.svg">
                        </template>
                        <h2 class="style-title-list">
                            Automatische e-mails
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

                    <STListItem :selectable="true" @click="deleteGroup()">
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

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, useNavigationController, usePresent, useShow } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, EditEmailTemplatesView, EditResourceRolesView, MembersTableView, PromiseView, STList, STListItem, STNavigationBar, Toast, useAuth, useOrganization, usePlatform } from "@stamhoofd/components";
import { useOrganizationManager } from '@stamhoofd/networking';
import { EmailTemplateType, Group, GroupCategory, GroupCategoryTree, GroupSettings, GroupStatus, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, PermissionLevel, PermissionsResourceType } from '@stamhoofd/structures';

import { computed } from 'vue';
import BillingWarningBox from '../settings/packages/BillingWarningBox.vue';
import EditGroupGeneralView from './edit/EditGroupGeneralView.vue';
import EditGroupPageView from './edit/EditGroupPageView.vue';
import EditGroupPricesView from './edit/EditGroupPricesView.vue';
import EditGroupRestrictionsView from './edit/EditGroupRestrictionsView.vue';
import EditGroupWaitinglistView from './edit/EditGroupWaitinglistView.vue';

const props = defineProps<{
    group: Group;
    period: OrganizationRegistrationPeriod;
}>()

const isPublic = computed(() => props.group.isPublic(props.period.availableCategories))
const title = computed(() => props.group.settings.name)
const isArchive = computed(() => props.group.status === GroupStatus.Archived)
const isOpen = computed(() => !props.group.closed)
const auth = useAuth();
const hasFullPermissions = computed(() => auth.canAccessGroup(props.group, PermissionLevel.Full))
const show = useShow();
const organizationManager = useOrganizationManager()
const organization = useOrganization()
const navigationController = useNavigationController()
const present = usePresent()
const isLocked = computed(() => props.period.period.locked)
const platform = usePlatform();

const linkedResponsibilities = computed(() => {
    if (props.group.defaultAgeGroupId === null) {
        return []
    }

    const id = props.group.defaultAgeGroupId
    return platform.value.config.responsibilities.filter(r => r.defaultAgeGroupIds !== null && r.defaultAgeGroupIds.includes(id) && (r.organizationTagIds === null || organization.value?.meta.matchTags(r.organizationTagIds)))
})

async function openMembers(animated = true, options: { waitingList?: boolean } = {}) {
    await show({
        components: [
            new ComponentWithProperties(MembersTableView, {
                group: props.group,
                waitingList: options.waitingList ?? false
            })
        ],
        animated,
        adjustHistory: animated
    })
}

async function displayEditComponent(component: any, animated = true) {
    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date group
                    await organizationManager.value.forceUpdate()
                    return new ComponentWithProperties(component, {
                        group: props.group, 
                        period: props.period,
                        organization: organization.value, 
                        saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                            patch.id = props.period.id
                            await organizationManager.value.patchPeriod(patch)
                        }
                    })
                } catch (e) {
                    Toast.fromError(e).show()
                    throw e
                }
            }
        })
    })

    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: "popup",
        components: [
            displayedComponent
        ]
    });
}


async function editGeneral(animated = true) {
    await displayEditComponent(EditGroupGeneralView, animated)
}

async function editRestrictions(animated = true) {
    await displayEditComponent(EditGroupRestrictionsView, animated)
}

async function editPrices(animated = true) {
    await displayEditComponent(EditGroupPricesView, animated)
}

async function editWaitinglist(animated = true) {
    await displayEditComponent(EditGroupWaitinglistView, animated)
}

async function editPermissions(animated = true) {
    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: "popup",
        components: [
            new ComponentWithProperties(EditResourceRolesView, {
                description: 'Kies hier wie deze inschrijvingsgroep kan bekijken, bewerken of beheren.',
                resource: {
                    id: props.group.id,
                    name: props.group.settings.name,
                    type: PermissionsResourceType.Groups
                },
                configurableAccessRights: []
            })
        ]
    });
}

async function editPage(animated = true) {
    await displayEditComponent(EditGroupPageView, animated)
}

async function editEmails(animated = true) {
    await present({
        components: [
            new ComponentWithProperties(EditEmailTemplatesView, {
                groupId: props.group.id,
                allowEditGenerated: false,
                types: [
                    EmailTemplateType.RegistrationConfirmation
                ]
            })
        ],
        modalDisplayStyle: "popup",
        animated,
    })
}

async function openGroup() {
    if (!await CenteredMessage.confirm("Ben je zeker dat je de inschrijvingen wilt openen?", "Ja, openen")) {
        return;
    }

    try {
        const p = Group.patch({
            id: props.group.id,
            status: GroupStatus.Open
        });

        if (props.group.settings.registrationStartDate && props.group.settings.registrationStartDate.getTime() > Date.now()) {
            p.settings = GroupSettings.patch({
                registrationStartDate: null
            })
        }

        if (props.group.settings.registrationEndDate && props.group.settings.registrationEndDate.getTime() <= Date.now()) {
            p.settings = GroupSettings.patch({
                registrationEndDate: null
            })
        }
        await organizationManager.value.patchGroup(props.period, p)
        new Toast("De inschrijvingen zijn terug open", "success green").show()
    } catch (e) {
        Toast.fromError(e).show()
    }
}

async function archiveGroup() {
    if (!await CenteredMessage.confirm("Ben je zeker dat je deze groep wilt archiveren?", "Ja, archiveren")) {
        return;
    }

    try {
        const settingsPatch = OrganizationRegistrationPeriodSettings.patch({})

        for (const category of props.period.settings.categories) {
            if (category.groupIds.includes(props.group.id)) {
                const catPatch = GroupCategory.patch({id: category.id})
                catPatch.groupIds.addDelete(props.group.id)
                settingsPatch.categories.addPatch(catPatch)
            }
        }

        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id,
            settings: settingsPatch
        })
        patch.groups.addPatch(Group.patch({
            id: props.group.id,
            status: GroupStatus.Archived
        }))

        await organizationManager.value.patchPeriod(patch)
        new Toast("De groep is gearchiveerd", "success green").show()
    } catch (e) {
        Toast.fromError(e).show()
    }
}

async function deleteGroup() {
    if (!await CenteredMessage.confirm("Ben je zeker dat je deze groep wilt verwijderen?", "Ja, verwijderen")) {
        return;
    }

    if (!await CenteredMessage.confirm("Je kan dit niet ongedaan maken en verliest gegevens van alle bijhorende leden?", "Ja, verwijderen")) {
        return;
    }

    try {
        const settingsPatch = OrganizationRegistrationPeriodSettings.patch({})

        for (const category of props.period.settings.categories) {
            if (category.groupIds.includes(props.group.id)) {
                const catPatch = GroupCategory.patch({id: category.id})
                catPatch.groupIds.addDelete(props.group.id)
                settingsPatch.categories.addPatch(catPatch)
            }
        }

        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id,
            settings: settingsPatch
        })
        patch.groups.addDelete(props.group.id)

        await organizationManager.value.patchPeriod(patch)
        new Toast("De groep is verwijderd", "success green").show()
        await navigationController.value?.pop({force: true})
    } catch (e) {
        Toast.fromError(e).show()
    }
}

const allCategories = computed(() => organization.value ? organization.value.getCategoryTree({admin: true, permissions: auth.permissions}).getAllCategories().filter(c => c.categories.length == 0) : [])

async function restoreGroup(event: MouseEvent) {
    if (allCategories.value.length == 1) {
        await unarchiveGroupTo(props.group, allCategories.value[0])
        return
    }

    const menu = new ContextMenu([
        allCategories.value.map(cat => 
            new ContextMenuItem({
                name: cat.settings.name,
                rightText: cat.groupIds.length+"",
                action: () => {
                    unarchiveGroupTo(props.group, cat).catch(console.error)
                    return true
                }
            })
        )
    ])
    await menu.show({ clickEvent: event })
}

async function unarchiveGroupTo(group: Group, cat: GroupCategoryTree) {
    if (!await CenteredMessage.confirm(`${group.settings.name} terugzetten naar ${cat.settings.name}?`, 'Ja, terugzetten')) {
        return
    }

    const wasArchive = isArchive.value

    try {
        const settingsPatch = OrganizationRegistrationPeriodSettings.patch({})
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

        settingsPatch.categories.addPatch(catPatch)

        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id,
            settings: settingsPatch
        })

        patch.groups.addPatch(Group.patch({
            id: group.id,
            status: GroupStatus.Closed
        }))

        try {
            await organizationManager.value.patchPeriod(patch)
            
            // Manually update this group
            const foundGroup = props.period.groups.find(g => g.id == group.id)
            if (foundGroup) {
                // Bit ugly, but only reliable way
                props.group.set(foundGroup)
            }
        } catch (e) {
            Toast.fromError(e).show()
        }
        new Toast(wasArchive ? "De inschrijvingsgroep is teruggezet" : "De inschrijvingen zijn gesloten", "success green").show()
    } catch (e) {
        Toast.fromError(e).show()
    }

}

async function closeGroup() {
    if (!await CenteredMessage.confirm("Ben je zeker dat je de inschrijvingen wilt sluiten?", "Ja, sluiten")) {
        return;
    }

    try {
        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id
        })
        patch.groups.addPatch(Group.patch({
            id: props.group.id,
            status: GroupStatus.Closed
        }))

        await organizationManager.value.patchPeriod(patch)
        new Toast("De inschrijvingen zijn gesloten", "success green").show()
    } catch (e) {
        Toast.fromError(e).show()
    }
}
</script>

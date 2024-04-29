<template>
    <div id="import-members-questions-view" class="st-view background">
        <STNavigationBar title="Leden importeren" :pop="canPop" :dismis="canDismiss" />

        <main>
            <h1>Importeer instellingen</h1>
            <p>We hebben nog wat aanvullende vragen over hoe we de leden moeten importeren.</p>
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="!saving">
                <p v-if="existingCount > 0 && existingCount === members.length" class="warning-box">
                    Alle leden uit jouw bestand zitten al in het systeem. Je gaat informatie in Stamhoofd overschrijven met informatie uit jouw bestand. Let goed op, je kan dit niet ongedaan maken.
                </p>
                <p v-else-if="existingCount > 0" class="warning-box">
                    {{ existingCount }} {{ existingCount == 1 ? 'lid' : 'leden' }} uit jouw bestand zitten al in het systeem ({{ members.length }} in totaal). Je gaat informatie in Stamhoofd overschrijven met informatie uit jouw bestand voor deze leden. Let goed op, je kan dit niet ongedaan maken.
                </p>

                <p v-if="deletedRegistrationsCount > 0" class="warning-box">
                    Stamhoofd zal {{ deletedRegistrationsCount }} inschrijvingen of wachtlijst inschrijvingen verplaatsen voor bestaande leden op basis van jouw bestand.
                </p>
                <p v-if="membersWithoutNewRegistrations.length" class="success-box">
                    {{ membersWithoutNewRegistrations.length }} leden uit jouw lijst zijn al ingeschreven. Hun huidige inschrijving(en) zullen niet worden aangepast. Hun andere gegevens uit het bestand zullen wel in Stamhoofd worden overgenomen.
                </p>

                <template v-if="membersWithNewRegistrations.length">
                    <hr>
                    <h2>Inschrijvingstatus</h2>

                    <STInputBox v-if="hasWaitingLists" title="Wil je deze leden op de wachtlijst zetten?" error-fields="waitingList" :error-box="errorBox" class="max">
                        <RadioGroup>
                            <Radio v-model="waitingList" :value="false">
                                Nee
                            </Radio>
                            <Radio v-model="waitingList" :value="true">
                                Ja, zet op wachtlijst
                            </Radio>
                        </RadioGroup>
                    </STInputBox>
                
                    <template v-if="!waitingList">
                        <STInputBox title="Moeten deze leden hun inschrijving voor de huidige periode nog bevestigen?" error-fields="needRegistration" :error-box="errorBox" class="max">
                            <RadioGroup>
                                <Radio v-model="needRegistration" :value="false">
                                    Nee, ze zijn al ingeschreven
                                </Radio>
                                <Radio v-model="needRegistration" :value="true">
                                    Ja, ze moeten hun inschrijving nog verlengen en betalen
                                </Radio>
                            </RadioGroup>
                        </STInputBox>

                        <p v-if="needRegistration === true" class="info-box">
                            De leden zullen worden ingeschreven in de vorige inschrijvingsperiode. Ze zullen zelf hun inschrijving eventueel nog moeten verlengen via het ledenportaal, maar hun gegevens zullen daar al klaar staan. De vorige periode is ook altijd zichtbaar voor beheerders in Stamhoofd.
                        </p>

                        <STInputBox v-if="needsPaidStatus" :title="needRegistration ? 'Al betaald voor vorige inschrijvingsperiode?' : 'Hebben deze leden al betaald?'" error-fields="paid" :error-box="errorBox" class="max">
                            <RadioGroup>
                                <Radio v-model="paid" :value="true">
                                    Al betaald
                                </Radio>
                                <Radio v-model="paid" :value="false">
                                    Niet betaald
                                </Radio>
                                <Radio v-model="paid" :value="null">
                                    Sommigen wel, anderen niet
                                </Radio>
                            </RadioGroup>
                        </STInputBox>

                        <p v-if="needsPaidStatus && somePaid" class="warning-box">
                            Van sommige leden hebben we in het bestand wel al de nodige betaalinformatie gevonden, bij hen wordt die informatie gebruikt en het bovenstaande genegeerd.
                        </p>

                        <p v-if="needsPaidStatus && paid === null" class="warning-box">
                            We zetten de betaalstatus van alle leden op 'niet betaald'. Jij moet achteraf dan aanduiden wie al betaald heeft. Als je dat niet wilt doen, kan je de betaalstatus opnemen in jouw bestand door een extra kolom 'Betaald' toe te voegen en daar ja/nee in te zetten. 
                        </p>
                    </template>
                </template>

                <template v-if="needsGroupAssignment">
                    <hr>
                    <h2>Inschrijvingsgroep</h2>

                    <p class="warning-box">
                        {{ membersNeedingAssignment.length }} leden uit jouw lijst hebben geen inschrijvingsgroep toegewezen gekregen (in een kolom). Kies hieronder hoe je deze wilt inschrijven in de juiste groep, of voeg een kolom in jouw bestand toe met de groep waar je elk lid wilt inschrijven.
                    </p>

                    <STInputBox title="Leeftijdsgroep toewijzen" error-fields="group" :error-box="errorBox" class="max">
                        <RadioGroup>
                            <Radio v-model="autoAssign" :value="true">
                                Automatisch groep bepalen
                            </Radio>
                            <Radio v-model="autoAssign" :value="false">
                                Allemaal in één groep inschrijven
                            </Radio>
                        </RadioGroup>

                        <template #right><button class="button text" type="button" @click.stop="openAssignment">
                            <span class="icon help" />
                            <span>Toon resultaat</span>
                        </button></template>
                    </STInputBox>

                    <template v-if="autoAssign">
                        <STInputBox v-if="membersWithMultipleGroups.length > 0" title="Prioriteit van groepen" error-fields="group" :error-box="errorBox" class="max">
                            <p class="info-box">
                                {{ membersWithMultipleGroups.length }} {{ membersWithMultipleGroups.length == 1 ? 'lid past' : 'leden passen' }} in meer dan één groep. Je kan hieronder een prioriteit instellen. Dan schrijven we elk lid in bij één van groepen waar hij in past die de hoogste prioriteit heeft. Als je wilt kan je de leeftijd of geslacht van elke leeftijdsgroep (tijdelijk) beperken om op die manier automatisch de juiste leeftijdsgroep te kiezen (dat doe je bij instellingen > inschrijvingsgroepen)
                            </p>

                            <STList v-model="draggableGroups" :draggable="true">
                                <STListItem v-for="(group, index) of multipleGroups" :key="group.id" class="right-description">
                                    {{ index + 1 }}. {{ group.settings.name }}

                                    <template #right>
                                        <span>{{ getGroupAutoAssignCountForPriority(group) }}</span>
                                        <button class="button icon external" type="button" @click="openPriorityAssignedToGroup(group)" />
                                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                                    </template>
                                </STListItem>
                            </STList>

                            <template #right><button type="button" class="button text" @click.stop="openMultipleGroups">
                                <span class="icon help" />
                                <span>Toon leden</span>
                            </button></template>
                        </STInputBox>


                        <STInputBox v-if="membersWithoutMatchingGroups.length > 0" title="In welke groep wil je leden inschrijven die nergens in passen?" error-fields="group" :error-box="errorBox" class="max">
                            <p class="info-box">
                                {{ membersWithoutMatchingGroups.length }} leden passen in geen enkele groep. Kies hieronder in welke groep je deze toch wilt inschrijven.
                            </p>

                            <Dropdown v-model="defaultGroup">
                                <option v-for="group of organization.groups" :key="group.id" :value="group">
                                    {{ group.settings.name }}
                                </option>
                            </Dropdown>

                            <template #right><button type="button" class="button text" @click.stop="openWithoutMatchingGroups">
                                <span class="icon help" />
                                <span>Toon leden</span>
                            </button></template>
                        </STInputBox>
                    </template>
                    <template v-else>
                        <STInputBox title="In welke groep wil je deze leden inschrijven?" error-fields="group" :error-box="errorBox" class="max">
                            <Dropdown v-model="defaultGroup">
                                <option v-for="group of organization.groups" :key="group.id" :value="group">
                                    {{ group.settings.name }}
                                </option>
                            </Dropdown>
                        </STInputBox>
                    </template>
                </template>
            </template>
        </main>

        <STToolbar>
            <template #right>
                <button type="button" class="button secundary" @click="openResultView">
                    Toon wijzigingen
                </button>

                <LoadingButton :loading="saving">
                    <button type="button" class="button primary" @click="goNext">
                        Importeer {{ members.length }} leden
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Dropdown, ErrorBox, LoadingButton, Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { Gender, Group, Organization, OrganizationPatch, Parent, ParentTypeHelper, Registration } from "@stamhoofd/structures";
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../../../classes/FamilyManager';
import { ImportingMember } from '../../../../../classes/import/ImportingMember';

import ImportAutoAssignedView from './ImportAutoAssignedView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        RadioGroup,
        Radio,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton,
        STList,
        STListItem,
        Dropdown
    },
})
export default class ImportMembersQuestionsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: this.$organization.id })

    @Prop({ required: true })
        members: ImportingMember[]


    paid: boolean | null = true
    waitingList = false
    needRegistration = false

    autoAssign = true
    multipleGroups: Group[] = []
    defaultGroup = this.organization.groups[0]

    mounted() {
        this.multipleGroups = this.calculateMultipleGroups()
        this.autoAssignMembers(this.members)
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }

    get needsPaidStatus() {
        return !!this.membersWithNewRegistrations.find(m => m.registration.paid === null && m.registration.paidPrice === null)
    }

    get somePaid() {
        return !!this.membersWithNewRegistrations.find(m => m.registration.paid !== null || m.registration.paidPrice !== null)
    }

    get needsGroupAssignment() {
        return this.membersNeedingAssignment.length > 0
    }

    get existingCount() {
        return this.members.filter(m => m.equal !== null).length
    }

    get hasWaitingLists() {
        return !!this.organization.groups.find(g => g.hasWaitingList())
    }

    get membersNeedingAssignment() {
        return this.members.filter(m => {
            return this.shouldAssignRegistrationToMember(m)
        })
    }

    get membersWithNewRegistrations() {
        return this.members.filter(m => {
            const registration = this.buildRegistration(m)
            if (!registration) {
                return false
            }
            return true;
        })
    }

    get membersWithoutNewRegistrations() {
        return this.members.filter(m => {
            const registration = this.buildRegistration(m)
            if (!registration) {
                return true
            }
            return false;
        })
    }

    get deletedRegistrationsCount() {
        return this.membersWithNewRegistrations.reduce((acc, m) => {
            const registration = this.buildRegistration(m)
            if (!registration) {
                return acc
            }
            return acc + this.getOverrideRegistrations(registration, m).length
        }, 0)
    }

    shouldAssignRegistrationToMember(m: ImportingMember) {
        if (m.registration.group !== null) {
            return false
        }

        if (m.equal && m.equal.activeRegistrations.length > 0 && !this.waitingList) {
            return false
        }

        if (m.equal && m.equal.waitingGroups.length > 0 && this.waitingList) {
            return false
        }

        return true
    }

    get membersWithMultipleGroups() {
        return this.membersNeedingAssignment.filter(m => {
            const groups = m.details.getMatchingGroups(this.organization.groups)
            return (groups.length > 1)
        })
    }

    get membersWithoutMatchingGroups() {
        return this.membersNeedingAssignment.filter(m => {
            const groups = m.details.getMatchingGroups(this.organization.groups)
            return (groups.length === 0)
        })
    }

    /**
     * Groups for which we need to set a priority, because some members fit in more than one of them
     */
    calculateMultipleGroups() {
        const groups = new Map<string, Group>()
        for (const member of this.members) {
            if (member.registration.group !== null) {
                continue
            }
            const g = member.details.getMatchingGroups(this.organization.groups)
            if (g.length > 1) {
                for (const gg of g) {
                    groups.set(gg.id, gg)
                }
            }
        }
        return [ ...groups.values() ].sort((a, b) => -Sorter.stack(Sorter.byNumberValue(a.settings.maxAge ?? 9, b.settings.maxAge ?? 99), Sorter.byNumberValue(a.settings.minAge ?? 0, b.settings.minAge ?? 0)))
    }

    /**
     * Map these members to their corresponding group (id), using priority, default etc
     */
    autoAssignMembers(members: ImportingMember[]) {
        for (const member of members) {
            if (!this.shouldAssignRegistrationToMember(member)) {
                member.registration.autoAssignedGroup = null
                continue
            }

            if (!this.autoAssign) {
                // TODO: use default group for all
                member.registration.autoAssignedGroup = this.defaultGroup
                continue
            }

            const g = member.details.getMatchingGroups(this.organization.groups)
            if (g.length === 0) {
                // use default: todo
                member.registration.autoAssignedGroup = this.defaultGroup
            } else if (g.length === 1) {
                member.registration.autoAssignedGroup = g[0]
            } else {
                // Get group that is first in the priority queue (= multipleGroups)
                member.registration.autoAssignedGroup = this.multipleGroups.find(group => {
                    return (g.includes(group))
                }) ?? this.defaultGroup
            }
        }
    }

    getGroupAutoAssignCountForPriority(group: Group) {
        this.autoAssignMembers(this.membersWithMultipleGroups)
        return this.membersWithMultipleGroups.reduce((current, member) => {
            if (member.registration.autoAssignedGroup && member.registration.autoAssignedGroup.id === group.id) {
                return current + 1
            }
            return current
        }, 0)
    }

    openAssignment() {
        this.autoAssignMembers(this.members)
        this.present(new ComponentWithProperties(ImportAutoAssignedView, {
            title: "Wijzigingen aan inschrijvingen",
            description: "Hier zie je bij welke groep we elk lid gaan inschrijven, op basis van jouw instellingen en het bestand",
            members: this.membersNeedingAssignment.flatMap(m => {
                if (m.registration.autoAssignedGroup === null) {
                    return []
                }

                return [{
                    name: m.details.name,
                    description: m.registration.autoAssignedGroup.settings.name
                }]
            })
        }).setDisplayStyle("popup"))
    }

    openPriorityAssignedToGroup(group: Group) {
        this.present(new ComponentWithProperties(ImportAutoAssignedView, {
            title: "Leden die door prioriteit bij "+group.settings.name+" zullen worden ingeschreven",
            description: "Deze leden passen in meerdere groepen, maar op basis van jouw prioriteit bij "+group.settings.name+" zullen worden ingeschreven",
            members: this.membersWithMultipleGroups.flatMap(m => {
                if (m.registration.group !== null) {
                    return []
                }

                if (m.registration.autoAssignedGroup?.id === group.id) {
                    const groups = m.details.getMatchingGroups(this.organization.groups)
                    return [{
                        name: m.details.name,
                        description: groups.map(g => g.settings.name).join(", ")
                    }]
                }

                return []                
            })
        }).setDisplayStyle("popup"))
    }

    openMultipleGroups() {
        this.present(new ComponentWithProperties(ImportAutoAssignedView, {
            title: "Leden die in meerdere groepen passen",
            description: "Dit zijn alle leden en de groepen waar ze in passen. Je kan beperken tot welke groepen ze horen door de instellingen van die groep te wijzigen.",
            members: this.membersWithMultipleGroups.flatMap(m => {
                if (m.registration.group !== null) {
                    return []
                }

                const groups = m.details.getMatchingGroups(this.organization.groups)
                return [{
                    name: m.details.name,
                    description: groups.map(g => g.settings.name).join(", ")
                }]
            })
        }).setDisplayStyle("popup"))
    }

    getParentDescription(parent: Parent) {
        const description: string[] = []
        let type = ParentTypeHelper.getName(parent.type)
        if (parent.name.trim()) {
            description.push(type + ': ' + parent.name)
        }
        if (parent.phone) {
            description.push(type + ' telefoonnummer: ' + parent.phone)
        }
        if (parent.email) {
            description.push(type + ' e-mail: ' + parent.email)
        }
        if (parent.address) {
            description.push(type + ' adres: ' + parent.address.toString())
        }
        return description;
    }

    openResultView() {
        this.present(new ComponentWithProperties(ImportAutoAssignedView, {
            title: "Wijzigingen",
            description: "Dit is een overzicht van alle wijzigingen die we gaan doorvoeren als je verder gaat met deze import.",
            members: this.members.map(member => {
                let description: string[] = []
                const registration = this.buildRegistration(member)

                if (registration !== null) {
                    const group = this.organization.groups.find(g => g.id === registration.groupId)
                    const groupName = (group?.settings.name ?? 'onbekende groep')

                    if (member.equal) {
                        if (registration !== null) {
                            if (registration.waitingList) {
                                description.push('Wachtlijst plaatsen voor ' + groupName)
                            } else {
                                description.push('Inschrijven voor ' + groupName)
                            }

                            // Delete conflicting registrations (based on categories too!)
                            const deleteRegs = this.getOverrideRegistrations(registration, member)
                            for (const r of deleteRegs) {
                                if (r.waitingList) {
                                    description.push('Verwijderen van wachtlijst van ' + (this.organization.groups.find(g => g.id === r.groupId)?.settings.name ?? 'onbekende groep'))
                                } else {
                                    description.push('Verwijderen inschrijving voor ' + (this.organization.groups.find(g => g.id === r.groupId)?.settings.name ?? 'onbekende groep'))
                                }
                            }
                        }
                    } else {
                        if (registration.waitingList) {
                            description.push('Toevoegen in het systeem en op wachtlijst plaatsen voor ' + groupName)
                        } else {
                            description.push('Toevoegen in het systeem met inschrijving voor ' + groupName)
                        }

                    }
                } else {
                    description.push('Geen wijziging aan inschrijvingen')
                }

                if (member.equal) {
                    // Data changes
                    if (member.equal.details.name !== member.details.name) {
                        description.push('Naam wijzigen naar ' + member.details.name)
                    }
                    if (member.details.gender !== Gender.Other && member.equal.details.gender !== member.details.gender) {
                        description.push('Geslacht wijzigen naar ' + member.details.gender)
                    }
                    if ( member.details.email && member.equal.details.email !== member.details.email) {
                        description.push('E-mail wijzigen naar ' + member.details.email)
                    }
                    if (member.details.phone && member.equal.details.phone !== member.details.phone) {
                        description.push('Telefoonnummer wijzigen naar ' + member.details.phone)
                    }
                    if (member.details.birthDay && (!member.equal.details.birthDay || Formatter.dateIso(member.equal.details.birthDay) !== Formatter.dateIso(member.details.birthDay))) {
                        description.push('Geboortedatum wijzigen naar ' + Formatter.date(member.details.birthDay, true))
                    }
                    for (const parent of member.details.parents) {
                        description.push(...this.getParentDescription(parent))
                    }
                    for (const answer of member.details.recordAnswers) {
                        description.push(answer.settings.name + ' wijzigen naar ' + answer.stringValue)
                    }
                } else {
                    // Data changes
                    if (member.details.name) {
                        description.push('Naam: ' + member.details.name)
                    }
                    if (member.details.gender !== Gender.Other) {
                        description.push('Geslacht: ' + member.details.gender)
                    }
                    if ( member.details.email) {
                        description.push('E-mail: ' + member.details.email)
                    }
                    if (member.details.phone) {
                        description.push('Telefoonnummer: ' + member.details.phone)
                    }
                    if (member.details.birthDay) {
                        description.push('Geboortedatum: ' + Formatter.date(member.details.birthDay, true))
                    }
                    for (const parent of member.details.parents) {
                        description.push(...this.getParentDescription(parent))
                    }

                    for (const answer of member.details.recordAnswers) {
                        description.push(answer.settings.name + ' wijzigen naar ' + answer.stringValue)
                    }
                }

                return {
                    name: member.details.name,
                    description: description.join('\n')
                }
            })
        }).setDisplayStyle("popup"))
    }

    get draggableGroups() {
        return this.multipleGroups;
    }

    set draggableGroups(groups) {
        if (groups.length != this.multipleGroups.length) {
            return;
        }

        this.multipleGroups = groups;
    }

    moveUp(index: number) {
        if (index === 0) {
            return
        }
        const deleted = this.multipleGroups.splice(index, 1)
        this.multipleGroups.splice(index - 1, 0, ...deleted)
    }

    moveDown(index: number) {
        if (index === this.multipleGroups.length - 1) {
            return
        }
        const deleted = this.multipleGroups.splice(index, 1)
        this.multipleGroups.splice(index + 1, 0, ...deleted)
    }

    openWithoutMatchingGroups() {
        this.present(new ComponentWithProperties(ImportAutoAssignedView, {
            title: "Leden die in geen enkele groep passen",
            description: "Dit zijn alle leden waarvoor we geen geschikte leeftijdsgroep konden vinden: omdat ze te oud of te jong zijn bijvoorbeeld. Pas de instellingen van jouw inschrijvingsgroepen eventueel aan.",
            members: this.membersWithoutMatchingGroups.flatMap(m => {
                return [{
                    name: m.details.name,
                    group: "/"
                }]
            })
        }).setDisplayStyle("popup"))
    }

    buildRegistration(member: ImportingMember) {
        const group = (member.registration.group ?? member.registration.autoAssignedGroup)

        if (!group) {
            return null
        }

        const cycle = group.cycle + (this.needRegistration && !this.waitingList ? -1 : 0);

        // Check if we are already registered for this group
        if (member.equal) {
            const existing = member.equal.filterRegistrations({groups: [group], cycle})

            if (existing.length && this.waitingList) {
                return null;
            }

            if (existing.length && !this.waitingList && existing.find(e => !e.waitingList)) {
                // already registered
                return null;
            }
        }
        

        const price = member.registration.price ?? group.settings.prices.find(p => p.startDate === null)?.getPriceFor(false) ?? 0
        
        let paidPrice = (member.registration.paid ?? this.paid ?? false) ? price : 0

        if (member.registration.paidPrice !== null) {
            paidPrice = member.registration.paidPrice
        }

        /*const payment = Payment.create({
            method: member.registration.paymentMethod ?? PaymentMethod.Unknown,
            status: paid ? PaymentStatus.Succeeded : PaymentStatus.Created,
            price: price,
            paidAt: paid ? new Date() : null,

            // Placeholders:
            createdAt: new Date(),
            updatedAt: new Date()
        })*/

        return Registration.create({
            groupId: group.id,
            cycle,
            waitingList: this.waitingList,
            price: this.waitingList ? undefined : price,
            pricePaid: this.waitingList ? undefined : paidPrice,
            registeredAt: this.waitingList ? null : (member.registration.date ?? new Date()),
            createdAt: member.registration.date ?? new Date(),
        })
    }

    getOverrideRegistrations(registration: Registration, member: ImportingMember): Registration[] {
        if (!member.equal) {
            return [];
        }

        let list: Registration[] = []

        // TODO: delete more conflicting registrations (based on categories too!)
        const group = this.organization.groups.find(g => g.id === registration.groupId)
        if (group) {
            if (!registration.waitingList) {
                // Delete from waiting list
                const existing = member.equal.filterRegistrations({groups: [group], cycle: registration.cycle, waitingList: true})
                for (const r of existing) {
                    if (list.find(l => l.id === r.id)) {
                        continue;
                    }
                    list.push(r)
                }
            }


            const parents = group.getParentCategories(this.organization.meta.categories, false)
            const cycleOffset = group.cycle - registration.cycle

            for (const parent of parents) {
                const groups = parent.groupIds.map(id => this.organization.groups.find(g => g.id === id)).filter(g => !!g) as Group[]

                if (parent.settings.maximumRegistrations === 1) {
                    // Delete all registrations for these groups
                    const existing = member.equal.filterRegistrations({groups: groups, cycleOffset})
                    for (const r of existing) {
                        if (list.find(l => l.id === r.id)) {
                            continue;
                        }
                        list.push(r)
                    }
                }
            }
        }
        return list;
    }

    async goNext() {
        if (this.saving) {
            return
        }

        this.saving = true

        // Show message 
        const toast = new Toast("Bezig met importeren...", "spinner").setHide(null).show()

        try {
            // Add all members that do not yet exist
            this.autoAssignMembers(this.members)

            // TODO: group family
            for (const member of this.members) {
                if (member.synced) {
                    // Already synced: prevent doing it twice
                    continue
                }
                const family =  new FamilyManager(this.$memberManager, [])

                if (member.equal) {
                    // Merge data (this is an edge case)
                    member.equal.details!.merge(member.details)
                    await family.patchAllMembersWith(member.equal)

                    const patchRegistrations: PatchableArrayAutoEncoder<Registration> = new PatchableArray()
                    const registration = this.buildRegistration(member)

                    if (registration !== null) {
                        // Okay to add: no duplicate
                        patchRegistrations.addPut(registration)
                        await family.patchMemberRegistrations(member.equal, patchRegistrations)

                        // Delete conflicting registrations (based on categories too!)
                        const deleteRegs = this.getOverrideRegistrations(registration, member)
                        for (const r of deleteRegs) {
                            patchRegistrations.addDelete(r.id)
                        }
                    }
                } else {
                    const registration = this.buildRegistration(member)
                    await family.addMember(member.details, registration ? [registration] : [])
                }
                member.synced = true
            }

            toast.hide()
            new Toast("Importeren voltooid", "success green").show()
            this.dismiss({ force: true })

        } catch (e) {
            toast.hide()
            console.error(e)
            Toast.fromError(e).show()
        }
        this.saving = false
    }
}
</script>
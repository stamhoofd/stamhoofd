<template>
    <div id="import-members-questions-view" class="st-view background">
        <STNavigationBar title="Leden importeren">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else class="button icon close gray" @click="pop" slot="right" />
        </STNavigationBar>

        <main>
            <h1>Importeer instellingen</h1>
            <p>We hebben nog wat aanvullende vragen over hoe we de leden moeten importeren.</p>

            <hr>
            <h2>Inschrijvingstatus</h2>

            <STInputBox title="Hebben deze leden het lidgeld al betaald?" error-fields="paid" :error-box="errorBox" class="max" v-if="needsPaidStatus">
                <RadioGroup>
                    <Radio v-model="paid" :value="true">Al betaald</Radio>
                    <Radio v-model="paid" :value="false">Niet betaald</Radio>
                    <Radio v-model="paid" :value="null">Sommigen wel, anderen niet</Radio>
                </RadioGroup>
            </STInputBox>

            <p class="warning-box" v-if="paid === null">
                We zetten de betaalstatus van alle leden op 'niet betaald'. Jij moet achteraf dan aanduiden wie al betaald heeft. Als je dat niet wilt doen, kan je de betaalstatus opnemen in jouw bestand door een extra kolom 'Betaald' toe te voegen en daar ja/nee in te zetten. 
            </p>


            <STInputBox title="Wil je deze leden op de wachtlijst zetten?" error-fields="waitingList" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-model="waitingList" :value="false">Nee</Radio>
                    <Radio v-model="waitingList" :value="true">Ja, zet op wachtlijst</Radio>
                </RadioGroup>
            </STInputBox>

            <STInputBox title="Moeten deze leden hun inschrijving voor de huidige periode nog bevestigen?" error-fields="needRegistration" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-model="needRegistration" :value="false">Nee, ze zijn al ingeschreven</Radio>
                    <Radio v-model="needRegistration" :value="true">Ja, ze moeten hun inschrijving nog verlengen</Radio>
                </RadioGroup>
            </STInputBox>

            <STInputBox title="Vorm gezinnen op basis van gegevens van de ouders" error-fields="waitingList" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-model="waitingList" :value="true">Ja (aangeraden)</Radio>
                    <Radio v-model="waitingList" :value="false">Nee</Radio>
                </RadioGroup>
            </STInputBox>

            <template v-if="needsGroup">
                <hr>
                <h2>Leeftijdsgroep</h2>

                <p class="warning-box">
                    {{ membersWithoutGivenGroup.length }} leden uit jouw lijst hebben geen leeftijdsgroep toegewezen gekregen (in een kolom). Kies hieronder hoe je deze wilt inschrijven in de juiste groep, of voeg een kolom in jouw bestand toe met de groep waar je elk lid wilt inschrijven.
                </p>

                <STInputBox title="Leeftijdsgroep toewijzen" error-fields="group" :error-box="errorBox" class="max">
                    <RadioGroup>
                        <Radio v-model="autoAssign" :value="true">Automatisch groep bepalen</Radio>
                        <Radio v-model="autoAssign" :value="false">Allemaal in één groep inschrijven</Radio>
                    </RadioGroup>

                    <button slot="right" class="button text" @click.stop="openAssignment">
                        <span class="icon help"/>
                        <span>Toon resultaat</span>
                    </button>
                </STInputBox>

                <template v-if="autoAssign">
                    <STInputBox v-if="membersWithMultipleGroups.length > 0" title="Prioriteit van leeftijdsgroepen" error-fields="group" :error-box="errorBox" class="max">
                        <p class="info-box">
                            {{ membersWithMultipleGroups.length }} leden passen in meer dan één groep. Je kan hieronder een prioriteit instellen. Dan schrijven we elk lid in bij één van groepen waar hij in past die de hoogste prioriteit heeft. Als je wilt kan je de leeftijd of geslacht van elke leeftijdsgroep (tijdelijk) beperken om op die manier automatisch de juiste leeftijdsgroep te kiezen (dat doe je bij instellingen > leeftijdsgroepen)
                        </p>

                        <STList>
                            <STListItem v-for="(group, index) of multipleGroups" class="right-description">
                                {{ index + 1 }}. {{ group.settings.name }}

                                <template slot="right">
                                    <button class="button text" @click="openPriorityAssignedToGroup(group)">
                                        <span class="icon external"/>
                                        <span>{{ getGroupAutoAssignCountForPriority(group) }} leden</span>
                                    </button>
                                    <button class="button icon arrow-up gray" @click.stop="moveUp(index)"/>
                                    <button class="button icon arrow-down gray" @click.stop="moveDown(index)"/>
                                </template>
                            </STListItem>
                        </STList>

                        <button class="button text" slot="right" @click.stop="openMultipleGroups">
                            <span class="icon help"/>
                            <span>Toon leden</span>
                        </button>
                    </STInputBox>


                    <STInputBox v-if="membersWithoutMatchingGroups.length > 0" title="In welke groep wil je leden inschrijven die nergens in passen?" error-fields="group" :error-box="errorBox" class="max">
                        <p class="info-box">
                            {{ membersWithoutMatchingGroups.length }} leden passen in geen enkele groep. Kies hieronder in welke groep je deze toch wilt inschrijven.
                        </p>

                        <select v-model="defaultGroup" class="input">
                            <option v-for="group of organization.groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </select>

                        <button class="button text" slot="right" @click.stop="openWithoutMatchingGroups">
                            <span class="icon help"/>
                            <span>Toon leden</span>
                        </button>
                    </STInputBox>
                </template>
                <template v-else>
                    <STInputBox title="In welke groep wil je deze leden inschrijven?" error-fields="group" :error-box="errorBox" class="max">
                        <select v-model="defaultGroup" class="input">
                            <option v-for="group of organization.groups" :key="group.id" :value="group">
                                {{ group.settings.name }}
                            </option>
                        </select>
                    </STInputBox>
                </template>
            </template>

            
            <STErrorsDefault :error-box="errorBox" />
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="goNext">
                        Importeer {{ members.length }} leden
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, PartialWithoutMethods, PatchableArray,PatchableArrayAutoEncoder,patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager,NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STList, STListItem, TimeInput, BackButton, CenteredMessage, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator} from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, File, Group, GroupPrices, Image, Organization, OrganizationMetaData, OrganizationModules, OrganizationPatch, OrganizationPrivateMetaData,PaymentMethod, Registration, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures"
import { Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";
import { FamilyManager } from '../../../../../classes/FamilyManager';
import { ImportingMember } from '../../../../../classes/import/ImportingMember';

import { OrganizationManager } from "../../../../../classes/OrganizationManager"
import ImportAutoAssignedViewView from './ImportAutoAssignedView.vue';

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
        STListItem
    },
})
export default class ImportMembersQuestionsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    @Prop({ required: true })
    members: ImportingMember[]


    paid: boolean | null = true
    waitingList: boolean = false
    needRegistration: boolean = false

    autoAssign = true
    multipleGroups: Group[] = []
    defaultGroup = this.organization.groups[0]

    mounted() {
        this.multipleGroups = this.calculateMultipleGroups()
    }

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get needsPaidStatus() {
        return !!this.members.find(m => m.registration.paid === null)
    }

    get needsGroup() {
        return !!this.members.find(m => m.registration.group === null)
    }
    
    get automaticallyAssigned() {
        return this.members.filter(m => {
            if (m.registration.group !== null) {
                return false
            }

            const groups = m.details.getMatchingGroups(this.organization.groups)
            return (groups.length === 1)
        })
    }

    get membersWithoutGivenGroup() {
        return this.members.filter(m => {
            if (m.registration.group !== null) {
                return false
            }

            return true
        })
    }

    get notAutomaticallyAssigned() {
        return this.members.filter(m => {
            if (m.registration.group !== null) {
                return false
            }

            const groups = m.details.getMatchingGroups(this.organization.groups)
            return (groups.length !== 1)
        })
    }

    get membersWithMultipleGroups() {
        return this.members.filter(m => {
            if (m.registration.group !== null) {
                return false
            }

            const groups = m.details.getMatchingGroups(this.organization.groups)
            return (groups.length > 1)
        })
    }

    get membersWithoutMatchingGroups() {
        return this.members.filter(m => {
            if (m.registration.group !== null) {
                return false
            }

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
            if (member.registration.group) {
                member.registration.autoAssignedGroup = null
                continue
            }

            if (!this.autoAssign) {
                // todo: use default group for all
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
        this.present(new ComponentWithProperties(ImportAutoAssignedViewView, {
            title: "Groepen die we hebben toegewezen",
            description: "Hier zie je bij welke groep we elk lid gaan inschrijven, op basis van leeftijd, geslacht en jouw instellingen",
            members: this.members.flatMap(m => {
                if (m.registration.autoAssignedGroup === null) {
                    return []
                }

                return [{
                    name: m.details.name,
                    group: m.registration.autoAssignedGroup.settings.name
                }]
            })
        }).setDisplayStyle("popup"))
    }

    openPriorityAssignedToGroup(group: Group) {
        this.present(new ComponentWithProperties(ImportAutoAssignedViewView, {
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
                        group: groups.map(g => g.settings.name).join(", ")
                    }]
                }

                return []                
            })
        }).setDisplayStyle("popup"))
    }

    openMultipleGroups() {
        this.present(new ComponentWithProperties(ImportAutoAssignedViewView, {
            title: "Leden die in meerdere groepen passen",
            description: "Dit zijn alle leden en de groepen waar ze in passen. Je kan beperken tot welke groepen ze horen door de instellingen van die groep te wijzigen.",
            members: this.membersWithMultipleGroups.flatMap(m => {
                if (m.registration.group !== null) {
                    return []
                }

                const groups = m.details.getMatchingGroups(this.organization.groups)
                return [{
                    name: m.details.name,
                    group: groups.map(g => g.settings.name).join(", ")
                }]
            })
        }).setDisplayStyle("popup"))
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
        this.present(new ComponentWithProperties(ImportAutoAssignedViewView, {
            title: "Leden die in geen enkele groep passen",
            description: "Dit zijn alle leden waarvoor we geen geschikte leeftijdsgroep konden vinden: omdat ze te oud of te jong zijn bijvoorbeeld. Pas de instellingen van jouw leeftijdsgroepen eventueel aan.",
            members: this.membersWithoutMatchingGroups.flatMap(m => {
                return [{
                    name: m.details.name,
                    group: "/"
                }]
            })
        }).setDisplayStyle("popup"))
    }

    async goNext() {
        if (this.saving) {
            return
        }

        this.saving = true

        // Show message 
        const toast = new Toast("Bezig met importeren...", "spinner").setWithOffset().setHide(null).show()

        try {
            // todo: Load all members and compare

            // Add all members that do not yet exist
            this.autoAssignMembers(this.members)

            // todo: group family
            for (const member of this.members) {
                const family =  new FamilyManager([])
                const group = (member.registration.group ?? member.registration.autoAssignedGroup)!
                await family.addMember(member.details, [
                    Registration.create({
                        groupId: group.id,
                        cycle: group.cycle + (this.needRegistration ? -1 : 0),
                        waitingList: this.waitingList,
                        payment: null, // todo
                        registeredAt: new Date()
                    })
                ])
            }

            toast.hide()
            new Toast("Importeren voltooid", "success green").setWithOffset().show()
            this.dismiss({ force: true })

        } catch (e) {
            toast.hide()
            console.error(e)
            new Toast(e.message, "error red").setWithOffset().show()
        }
        this.saving = false
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>

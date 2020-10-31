<template>
    <div class="boxed-view">
        <div class="st-view" v-if="members.length == 0">
            <main>
                <h1>Voeg de leden toe die je wilt inschrijven</h1>

                <p v-if="organizationGender == 'M'">Klik op de knop onderaan en voeg alle broers toe die je wilt inschrijven.</p>
                <p v-else-if="organizationGender == 'F'">Klik op de knop onderaan en voeg alle zussen toe die je wilt inschrijven.</p>
                <p v-else>Klik op de knop onderaan en voeg alle leden toe die je wilt inschrijven (bv. broers en zussen).</p>

                <STErrorsDefault :error-box="errorBox" />
            </main>
            <STToolbar>
                <button class="primary button" slot="right" @click="addNewMember">
                    <span class="icon white left add"/>
                    <span>Lid inschrijven</span>
                </button>
            </STToolbar>
        </div>
        <div class="st-view" v-else>
            <main>
                <h1 v-if="defaultSelection">Wil je nog iemand inschrijven?</h1>
                <h1 v-else>Wie wil je inschrijven?</h1>

                <p v-if="organizationGender == 'M'">Voeg eventueel broers toe zodat we ze in één keer kunnen afrekenen</p>
                <p v-else-if="organizationGender == 'F'">Voeg eventueel zussen toe zodat we ze in één keer kunnen afrekenen</p>
                <p v-else>Voeg eventueel broers en zussen toe zodat we ze in één keer kunnen afrekenen</p>

                <STErrorsDefault :error-box="errorBox" />

                <STList class="member-selection-table">
                    <STListItem v-for="member in members" :key="member.id" :selectable="member.groups.length == 0" class="right-stack left-center" @click="toggleMember(member)">
                        <Checkbox v-model="memberSelection[member.id]" slot="left" :manual="true"/>
                        <p>{{ member.firstName }} {{ member.details ? member.details.lastName : "" }}</p>                        
                        <p class="member-group" v-if="getWaitingListGroups(member).length > 0">Op wachtlijst zetten voor {{ getWaitingListGroups(member).map(g => g.settings.name).join(", ") }}</p>
                        <p class="member-group" v-else-if="getRegisterGroups(member).length > 0">Inschrijven bij {{ getRegisterGroups(member).map(g => g.settings.name).join(", ") }}</p>
                        <p class="member-group" v-else-if="member.acceptedWaitingGroups.length > 0">Toegelaten tot {{ member.acceptedWaitingGroups.map(g => g.settings.name ).join(", ") }}, schrijf nu in!</p>
                        <p class="member-group" v-else>Kies een groep</p>

                        <template slot="right">
                            <button class="button text limit-space" @click.stop="editMember(member)" v-if="isValid(member)">
                                <span class="icon edit" />
                                <span>Bewerken</span>
                            </button>
                            <div class="button text limit-space" v-else>
                                <span>Invullen / nakijken</span>
                                <span class="icon arrow-right" />
                            </div>
                            
                        </template>
                    </STListItem>
                </STList>
            </main>

            <STToolbar>
                <button slot="right" class="button secundary" @click="addNewMember">
                    <span class="icon add"/>
                    <span>Nog iemand toevoegen</span>
                </button>
                <button slot="right" class="button primary" @click="registerSelectedMembers" :disabled="selectedMembers.length == 0" v-if="!hasWaitingList">
                    <span>Inschrijven</span>
                    <span class="icon arrow-right"/>
                </button>
                <button slot="right" class="button primary" @click="registerSelectedMembers" :disabled="selectedMembers.length == 0" v-else>
                    <span>Inschrijven (of wachtlijst)</span>
                    <span class="icon arrow-right"/>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin, HistoryManager } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox, CenteredMessage, STErrorsDefault } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, Payment, PaymentDetailed, RegistrationWithMember, SelectedGroup, GroupGenderType } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import FinancialSupportView from './FinancialSupportView.vue';
import { Formatter } from '@stamhoofd/utility';
import TransferPaymentView from './TransferPaymentView.vue';
import PaymentSelectionView from './PaymentSelectionView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        STErrorsDefault
    },
    filters: {
        price: Formatter.price
    }
})
export default class RegistrationOverviewView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    OrganizationManager = OrganizationManager

    memberSelection: { [key:string]:boolean; } = {}

    step = 1
    defaultSelection = false
    errorBox: ErrorBox | null = null

    mounted() {
        HistoryManager.setUrl("/")
        
        // tdoo: auto prefer all members with only one group option
        this.updateSelection()
    }

    get organizationGender() {
        const male = OrganizationManager.organization.groups.find(g => g.settings.genderType == GroupGenderType.OnlyMale || g.settings.genderType == GroupGenderType.Mixed)
        const female = OrganizationManager.organization.groups.find(g => g.settings.genderType == GroupGenderType.OnlyFemale || g.settings.genderType == GroupGenderType.Mixed)
        if (male && !female) {
            return "M"
        }
        if (female && !male) {
            return "F"
        }
        return "X"
    }

    get hasWaitingList() {
        return this.selectedMembers.find(m => this.getWaitingListGroups(m).length > 0)
    }

    updateSelection() {
        if (!MemberManager.members) {
            return
        }

        for (const member of MemberManager.members) {
            if (this.memberSelection[member.id] === undefined) {
                // If we already selected some groups for this member, we select it by default
                if (this.isValid(member) && this.canRegister(member)) {
                    this.$set(this.memberSelection, member.id, true)
                    this.defaultSelection = true
                } else {
                    this.$set(this.memberSelection, member.id, false)
                }
            }
        }       
    }

    get selectedMembers() {
        return this.members.flatMap((m) => {
            if (this.memberSelection[m.id] === true) {
                return [m]
            }
            return []
        })
    }

    get members() {
        if (!MemberManager.members) {
            return []
        }
       
        return MemberManager.members.filter(m => !m.hasActiveRegistrations())
    }

    /**
     * Whether a member is still selectable to register (e.g. because you can select more groups)
     */
    canRegister(member: MemberWithRegistrations) {
        return member.canRegister(OrganizationManager.organization.groups)
    }

    /**
     * Whether a member needs manual validation before it can get selected
     */
    isValid(member: MemberWithRegistrations) {
        // doe we have group selected?
        const groups = this.getSelectedGroups(member)
        if (groups.length == 0) {
            return false
        }

        // waitingList = true if all groups are waiting lists
        const waitingList = !groups.find(g => !g.waitingList)
        
        // Validate if records are valid and up to date
        return member.isComplete(waitingList)
    }

    toggleMember(member: MemberWithRegistrations) {
        if (this.memberSelection[member.id]) {
            this.$set(this.memberSelection, member.id, false)
            this.updateSelection()
            return;
        }
        this.selectMember(member)
    }

    selectMember(member: MemberWithRegistrations, preventPopup = false) {
        if (!this.isValid(member)) {
            // Member is invalid, first complete all information before selecting it
            if (preventPopup) {
                return false
            }

            this.present(new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(MemberGeneralView, {
                    initialMember: member,
                    beforeCloseHandler: () => {
                        // Search up to date member
                        const m = this.members.find(m => m.id == member.id)
                        if (m) {
                            this.selectMember(m, true)
                        }
                    }
                })
            }).setDisplayStyle("popup"))
            return false
        }

        if (!this.canRegister(member)) {
            if (preventPopup) {
                return false
            }
            
            new CenteredMessage(member.firstName+" is al ingeschreven", "Je kan dit lid niet nog eens inschrijven.", "error").addCloseButton().show()
            return
        }

        this.$set(this.memberSelection, member.id, true)
        this.updateSelection()
    }

    /**
     *  Return the groups a member will get registered in, if active
     * 
     */
    getSelectedGroups(member: MemberWithRegistrations): SelectedGroup[] {
        return member.getSelectedGroups(OrganizationManager.organization.groups)
    }

    getWaitingListGroups(member: MemberWithRegistrations): Group[] {
        return this.getSelectedGroups(member).filter(g => g.waitingList).map(g => g.group)
    }

    getRegisterGroups(member: MemberWithRegistrations): Group[] {
        return this.getSelectedGroups(member).filter(g => !g.waitingList).map(g => g.group)
    }

    addNewMember() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {
                beforeCloseHandler: () => {
                    // Search up to date member
                    this.updateSelection()
                }
            })
        }).setDisplayStyle("popup"))
    }

    editMember(member: MemberWithRegistrations) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {
                initialMember: member
            })
        }).setDisplayStyle("popup"))
    }

    registerSelectedMembers() {
        if (!this.members) {
            return
        }

        const selected = this.selectedMembers;

        if (selected.length == 0) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Selecteer eerst een lid of voeg een nieuw lid toe"
            }))
            return;
        }
        this.errorBox = null;

        // todo: check waiting list validations etc
        if (this.shouldAskFinancialSupport) {
            this.show(new ComponentWithProperties(FinancialSupportView, {
                selectedMembers: selected
            }))
        } else {
            this.show(new ComponentWithProperties(PaymentSelectionView, {
                selectedMembers: selected
            }))
        }
    }


     get shouldAskFinancialSupport() {
         // do not ask for waiting list
        return !!this.selectedMembers.find(m => this.getRegisterGroups(m).length > 0);
        
        /*const groups = OrganizationManager.organization.groups
        for (const member of this.selectedMembers) {
            const preferred = member.getSelectedGroups(groups)

            for (const selected of preferred) {
                // If not a waiting list, and if it has a reduced price
                if (!!selected.group.settings!.prices.find(p => p.reducedPrice !== null) && !selected.waitingList) {
                    return true
                }
            }
        }
        return false*/
    }

    openPayment(payment: PaymentDetailed) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(TransferPaymentView, {
                payment,
                isPopup: true
            })
        }).setDisplayStyle("popup"))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.member-selection-table {
    .member-group {
        @extend .style-description-small;
        margin-top: 5px;
        line-height: 1; // to fix alignment
    }
}
</style>
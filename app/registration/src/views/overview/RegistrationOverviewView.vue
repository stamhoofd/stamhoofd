<template>
    <div class="boxed-view">
        <div class="st-view" v-if="members.length == 0">
            <main>
                <h1>Je hebt nog niemand ingeschreven</h1>
                <p>Je hebt nog niemand ingeschreven voor dit werkjaar. Begin met iemand in te schrijven.</p>
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

                <p>Voeg eventueel broers en zussen toe zodat we ze in één keer kunnen afrekenen</p>


                <STErrorsDefault :error-box="errorBox" />

                <STList class="member-selection-table">
                    <STListItem v-for="member in members" :key="member.id" :selectable="member.groups.length == 0" class="right-stack left-center" element-name="label" >
                        <Checkbox v-model="member.activeRegistrations.length > 0 ? true :memberSelection[member.id]" slot="left" @click.native.stop @change="onSelectMember(member)" :disabled="member.activeRegistrations.length > 0"/>
                        <p>{{ member.details.name }}</p>
                        <p class="member-group" v-if="member.groups.length > 0">Reeds ingeschreven bij {{ member.groups.map(g => g.settings.name ).join(", ") }}</p>
                        <p class="member-group" v-if="member.waitingGroups.length > 0">Reeds op wachtlijst voor {{ member.waitingGroups.map(g => g.settings.name ).join(", ") }}</p>
                        <template v-if="member.activeRegistrations.length == 0">
                            <p class="member-group" v-if="memberGetGroups(member, true).length > 0">Op wachtlijst zetten voor {{ memberGetGroups(member, true).map(g => g.settings.name).join(", ") }}</p>
                            <p class="member-group" v-if="memberGetGroups(member, false).length > 0">Inschrijven bij {{ memberGetGroups(member, false).map(g => g.settings.name).join(", ") }}</p>
                            <p class="member-group" v-if="memberGetGroups(member).length == 0">Kies eerst een groep</p>
                        </template>

                        <template slot="right">
                            <button class="button text limit-space" @click.stop="editMember(member)" v-if="memberGetGroups(member).length != 0 || member.activeRegistrations.length > 0">
                                <span class="icon edit" />
                                <span>Bewerken</span>
                            </button>
                            <div class="button text limit-space" v-else>
                                <span>Kies groep</span>
                                <span class="icon arrow-right" />
                            </div>
                            
                        </template>
                    </STListItem>
                </STList>
            </main>

            <STToolbar v-if="!canRegisterMembers">
                <button slot="right" class="button primary" @click="addNewMember">
                    <span class="icon add"/>
                    <span>Iemand toevoegen</span>
                </button>
            </STToolbar>
            <STToolbar v-else>
                <button slot="right" class="button secundary" @click="addNewMember">
                    <span class="icon add"/>
                    <span>Nog iemand toevoegen</span>
                </button>
                <button slot="right" class="button primary" @click="registerSelectedMembers" :disabled="selectedMembers.length == 0">
                    <span>Inschrijven</span>
                    <span class="icon arrow-right"/>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox, CenteredMessage, STErrorsDefault } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, Payment, PaymentDetailed, RegistrationWithMember } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import FinancialSupportView from './FinancialSupportView.vue';
import { Formatter } from '@stamhoofd/utility';
import TransferPaymentView from './TransferPaymentView.vue';

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
    memberSelection: { [key:string]:boolean; } = {}
    step = 1
    defaultSelection = false
    errorBox: ErrorBox | null = null

    /**
     * Return members that are currently registered in
     */
    get registeredMembers() {
        return this.members.filter(m => m.activeRegistrations.length > 0)
    }

    get canRegisterMembers() {
        return !!this.members.find(m => m.activeRegistrations.length == 0)
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
        for (const member of MemberManager.members) {
            if (this.memberSelection[member.id] === undefined) {
                // if the member doesn't have any registrations, we select it by default
                if (member.registrations.length == 0 && this.memberGetGroups(member).length > 0) {
                    this.$set(this.memberSelection, member.id, true)
                    this.defaultSelection = true
                } else {
                    this.$set(this.memberSelection, member.id, false)
                }
            }
        }
        return MemberManager.members
    }

    onSelectMember(member: MemberWithRegistrations) {
        if (!member.details) {
            return
        }
        if (this.memberSelection[member.id] === false) {
            return;
        }

        if (member.groups.length > 0) {
            this.$nextTick(() => {
                this.memberSelection[member.id] = false;
                console.log(this.memberSelection)
            })

            const errorMessage = new ComponentWithProperties(CenteredMessage, { 
                type: "error",
                title: member.details.firstName+" is al ingeschreven", 
                description: "Je kan dit lid niet nog eens inschrijven.",
                closeButton: "Sluiten",
            }).setDisplayStyle("overlay");
            this.present(errorMessage)
            return
        }

        if (this.memberGetGroups(member).length == 0) {

            // Disable select until group is chosen
            this.$nextTick(() => {
                this.memberSelection[member.id] = false;
            })

            this.present(new ComponentWithProperties(MemberGroupView, {
                member,
                memberDetails: member.details,
                handler: (component: MemberGroupView) => {
                    if (!member.details) {
                        console.error("Member details suddenly gone")
                        return
                    }
                    
                    component.loading = true;

                    MemberManager.patchMembers([
                        member
                    ]).then(() => {
                        component.pop({ force: true })
                        this.memberSelection[member.id] = true;
                    }).catch(e => {
                        console.error(e)
                        component.loading = false
                        component.errorBox = new ErrorBox(new SimpleError({
                            code: "",
                            message: "Er ging iets mis"
                        }))
                    })
                }
            }).setDisplayStyle("popup"))
        }
    }

    memberGetGroups(member: MemberWithRegistrations, waitingList: boolean | null = null): Group[] {
        if (!member.details) {
            return []
        }

        console.log(waitingList)

        const groups = OrganizationManager.organization.groups
        return member.details.getPreferredGroups(groups, waitingList)
    }

    addNewMember() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {})
        }).setDisplayStyle("popup"))
    }

    editMember(member: MemberWithRegistrations) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {
                member
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

        this.show(new ComponentWithProperties(FinancialSupportView, {
            selectedMembers: selected
        }))
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
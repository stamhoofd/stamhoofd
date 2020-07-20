<template>
    <div class="boxed-view">
        <div class="st-view" v-if="members.length == 0">
            <main>
                <h1>Je hebt nog niemand ingeschreven</h1>
                <p>Je hebt nog niemand ingeschreven voor dit werkjaar. Begin met iemand in te schrijven.</p>
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
                <h1>Wie wil je inschrijven?</h1>

                <p>Voeg eventueel broers en zussen toe zodat we ze in één keer kunnen afrekenen</p>

                <STList class="member-selection-table">
                    <STListItem v-for="member in members" :key="member.id" :selectable="true" class="right-stack left-center" element-name="label" >
                        <Checkbox v-model="memberSelection[member.id]" slot="left" @click.native.stop @change="onSelectMember(member)" />
                        <p>{{ member.details.name }}</p>
                        <p class="member-group" v-if="member.groups.length > 0">Reeds ingeschreven bij {{ member.groups.map(g => g.settings.name ).join(", ") }}</p>
                        <p class="member-group" v-else-if="memberGetGroup(member)">Inschrijven bij {{ memberGetGroup(member).settings.name }}</p>
                        <p class="member-group" v-else>Kies eerst een groep</p>

                        <template slot="right">
                            <button class="button text limit-space" @click.stop="editMember(member)">
                                <span class="icon edit" />
                                <span>Bewerken</span>
                            </button>
                            
                        </template>
                    </STListItem>
                </STList>
            </main>

            <STToolbar>
                <button slot="right" class="button primary" @click="addNewMember">
                    <span class="icon add"/>
                    <span>Nog iemand toevoegen</span>
                </button>
                <button slot="right" class="button secundary" @click="registerSelectedMembers">
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
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox, CenteredMessage } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { DecryptedMember, Group, Payment, PaymentDetailed, RegistrationWithMember } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import FinancialProblemsView from './FinancialProblemsView.vue';
import { Formatter } from '@stamhoofd/utility';
import TransferPaymentView from './TransferPaymentView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
    },
    filters: {
        price: Formatter.price
    }
})
export default class RegistrationOverviewView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    memberSelection: { [key:string]:boolean; } = {}
    step = 1

    /**
     * Return members that are currently registered in
     */
    get registeredMembers() {
        return this.members.filter(m => m.activeRegistrations.length > 0)
    }

    get members() {
        if (!MemberManager.members) {
            return []
        }
        for (const member of MemberManager.members) {
            if (this.memberSelection[member.id] === undefined) {
                // if the member doesn't have any registrations, we select it by default
                if (member.registrations.length == 0 && this.memberGetGroup(member) !== null) {
                    this.$set(this.memberSelection, member.id, true)
                } else {
                    this.$set(this.memberSelection, member.id, false)
                }
            }
        }
        return MemberManager.members
    }

    onSelectMember(member: DecryptedMember) {
        if (!member.details) {
            return
        }
        if (this.memberSelection[member.id] === false) {
            return;
        }

        if (member.groups.length > 0) {
            // Disable select until group is chosen
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
        if (this.memberGetGroup(member) === null) {
            // Disable select until group is chosen
            this.$nextTick(() => {
                this.memberSelection[member.id] = false;
                console.log(this.memberSelection)
            })

            this.present(new ComponentWithProperties(MemberGroupView, {
                memberDetails: member.details,
                handler: (group: Group, component: MemberGroupView) => {
                    if (!member.details) {
                        console.error("Member details suddenly gone")
                        return
                    }
                    
                    component.loading = true;

                    member.details.preferredGroupId = group.id

                    MemberManager.patchMembers([
                        member
                    ]).then(() => {
                        component.pop()
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

    memberGetGroup(member: DecryptedMember): Group | null {
        if (!member.details) {
            return null
        }

        const groups = OrganizationManager.organization.groups
        return member.details.getPreferredGroup(groups)
    }

    addNewMember() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {})
        }).setDisplayStyle("popup"))
    }

    editMember(member: DecryptedMember) {
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
        this.show(new ComponentWithProperties(FinancialProblemsView, {
            selectedMembers: this.members.flatMap((m) => {
                if (this.memberSelection[m.id] === true) {
                    return [m]
                }
                return []
            })
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
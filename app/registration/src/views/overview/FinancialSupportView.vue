<template>
    <div class="boxed-view">
        <div class="st-view">
            <main v-if="shouldShow">
                <h1>Financiële ondersteuning</h1>
                <p>We doen ons best om de kostprijs van onze activiteiten zo laag mogelijk te houden. Daarnaast voorzien we middelen om gezinnen die dat nodig hebben te ondersteunen. Om de drempel zo laag mogelijk te houden, voorzien we een discrete checkbox waarmee je kan aangeven dat je ondersteuning nodig hebt. We gaan hier uiterst discreet mee om. Dit is enkel zichtbaar voor de takleiding. </p>

                <STErrorsDefault :error-box="errorBox" />

                <Checkbox v-model="reduced">Mijn gezin heeft nood aan financiële ondersteuning en ik wil dit discreet kenbaar maken</Checkbox>
            </main>
            <main v-else>
                <h1>Bevestig registratie</h1>
                <p>Heb je alle leden toegevoegd?</p>

                <STErrorsDefault :error-box="errorBox" />
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span>Registratie bevestigen</span>
                        <span class="icon arrow-right"/>
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins,  Prop } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingButton, Checkbox, ErrorBox, STErrorsDefault } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, RegisterMembers, RegisterMember, PaymentMethod, Payment, PaymentStatus, RegisterResponse, KeychainedResponse, RecordType, Record } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import TransferPaymentView from './TransferPaymentView.vue';
import { SessionManager } from '@stamhoofd/networking';
import { Decoder } from '@simonbackx/simple-encoding';
import RegistrationSuccessView from './RegistrationSuccessView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        LoadingButton,
        STErrorsDefault
    }
})
export default class FinancialSupportView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    step = 2

    @Prop({ required: true })
    selectedMembers: MemberWithRegistrations[]

    reduced = false
    loading = false
    errorBox: ErrorBox | null = null

    get shouldShow() {
        const groups = OrganizationManager.organization.groups
        for (const member of this.selectedMembers) {
            const preferred = member.getSelectedGroups(groups)

            for (const selected of preferred) {
                // If not a waiting list, and if it has a reduced price
                if (!!selected.group.settings!.prices.find(p => p.reducedPrice !== null) && !selected.waitingList) {
                    return true
                }
            }
        }
        return false
    }

    async goNext() {
        if (this.loading) {
            return
        }
        const session = SessionManager.currentSession!
        this.loading = true

        try {
            let needsSync = false;
            if (this.reduced) {
                // Update reduced
                for (const member of this.selectedMembers) {
                    if (!member.details!.records.find(r => r.type == RecordType.FinancialProblems)) {
                        member.details!.records.push(Record.create({
                            type: RecordType.FinancialProblems
                        }))
                        needsSync = true;
                    }
                }
            } else {
                // Update reduced
                for (const member of this.selectedMembers) {
                    const i = member.details!.records.findIndex(r => r.type == RecordType.FinancialProblems)
                    if (i != -1) {
                        member.details!.records.splice(i, 1);
                        needsSync = true;
                    }
                }
            }

            if (needsSync) {
                await MemberManager.patchAllMembersWith(...this.selectedMembers)
            }

            const groups = OrganizationManager.organization.groups

// Create registrations
            const response = await session.authenticatedServer.request({
                method: "POST",
                path: "/user/members/register",
                body: RegisterMembers.create({
                    members: this.selectedMembers.flatMap(m => {
                        if (!m.details) {
                            throw new SimpleError({
                                code: "",
                                message: "Data is niet leesbaar"
                            })
                        }

                        const preferred = m.getSelectedGroups(groups)

                        if (preferred.length == 0) {
                            throw new SimpleError({
                                code: "",
                                message: "Nog geen groep gekozen"
                            })
                        }

                        return preferred.map(g => RegisterMember.create({
                            memberId: m.id,
                            groupId: g.group.id,
                            reduced: this.reduced,
                            waitingList: g.waitingList
                        }))
                        
                    }),
                    paymentMethod: PaymentMethod.Transfer
                }),
                decoder: RegisterResponse as Decoder<RegisterResponse>
            })

            MemberManager.setMembers(new KeychainedResponse({ data: response.data.members, keychainItems: []}))

            const payment = response.data.payment

            
            this.loading = false
            const registrations = await MemberManager.getRegistrationsWithMember(response.data.registrations)
            console.log(registrations)

            if (!payment) {
                this.show(new ComponentWithProperties(RegistrationSuccessView, {
                    registrations
                }))
                return;
            }

            if (payment.status == PaymentStatus.Succeeded) {
                this.show(new ComponentWithProperties(RegistrationSuccessView, {
                    registrations
                }))
            } else {
                this.show(new ComponentWithProperties(TransferPaymentView, {
                    payment,
                    registrations
                }))
            }
            
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.loading = false
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
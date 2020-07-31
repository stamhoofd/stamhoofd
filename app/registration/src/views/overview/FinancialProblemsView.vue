<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>De kostprijs van scouting</h1>

                <p>We doen ons best om de kostprijs van scouting zo laag mogelijk te houden. Daarnaast voorzien we middelen om gezinnen die dat nodig hebben te ondersteunen. Om de drempel zo laag mogelijk te houden, voorzien we een discrete checkbox waarmee je kan aangeven dat je ondersteuning nodig hebt. We gaan hier uiterst discreet mee om. Dit is enkel zichtbaar voor de takleiding. </p>

                <Checkbox v-model="reduced">Mijn gezin heeft nood aan financiële ondersteuning en ik wil dit discreet kenbaar maken aan de leiding.</Checkbox>
            </main>

            <STToolbar>
                <Spinner slot="right" v-if="loading" />
                <button slot="right" class="button primary" @click="goNext">
                    <span>Volgende</span>
                    <span class="icon arrow-right"/>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins,  Prop } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, Spinner, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, RegisterMembers, RegisterMember, PaymentMethod, Payment, PaymentStatus } from '@stamhoofd/structures';
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
        Spinner
    }
})
export default class FinancialProblemsView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    step = 2

    @Prop({ required: true })
    selectedMembers: MemberWithRegistrations[]

    reduced = false
    loading = false

    async goNext() {
        if (this.loading) {
            return
        }
        const session = SessionManager.currentSession!
        this.loading = true

        try {
            const groups = OrganizationManager.organization.groups

// Create registrations
            const response = await session.authenticatedServer.request({
                method: "POST",
                path: "/user/members/register",
                body: RegisterMembers.create({
                    members: this.selectedMembers.map(m => {
                        if (!m.details) {
                            throw new SimpleError({
                                code: "",
                                message: "Data is niet leesbaar"
                            })
                        }

                        const group = m.details.getPreferredGroup(groups)

                        if (!group) {
                            throw new SimpleError({
                                code: "",
                                message: "Nog geen groep gekozen"
                            })
                        }

                        return RegisterMember.create({
                            memberId: m.id,
                            groupId: group.id,
                            reduced: this.reduced
                        })
                    }),
                    paymentMethod: PaymentMethod.Transfer
                }),
                decoder: Payment as Decoder<Payment>
            })

            const payment = response.data

            // We need to update members, to enricht the payment too
            try {
                await MemberManager.loadMembers()
            } catch (ee) {
                // ignore
                console.error(ee)
            }

            this.loading = false

            if (payment.status == PaymentStatus.Succeeded) {
                this.show(new ComponentWithProperties(RegistrationSuccessView, {
                    payment: MemberManager.getPaymentDetailed(payment)
                }))
            } else {
                this.show(new ComponentWithProperties(TransferPaymentView, {
                    payment
                }))
            }
            
        } catch (e) {
            console.error(e)
            // todo
            this.loading = false
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
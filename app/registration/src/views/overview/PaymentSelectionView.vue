<template>
    <div class="boxed-view">
        <div class="st-view">
            <main v-if="paymentMethods.length > 1">
                <h1>Kies een betaalmethode</h1>

                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="paymentMethod in paymentMethods" :key="paymentMethod" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio slot="left" name="choose-payment-method" v-model="selectedPaymentMethod" :value="paymentMethod"/>
                        {{ getName(paymentMethod) }}
                    </STListItem>
                </STList>

            </main>
            <main v-else>
                <h1>Bevestig registratie</h1>
                <p>Heb je alle leden toegevoegd?</p>

                <STErrorsDefault :error-box="errorBox" />
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span>Betalen</span>
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
import { STNavigationBar, STToolbar, STList, STListItem, LoadingButton, Radio, ErrorBox, STErrorsDefault } from "@stamhoofd/components"
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
        Radio,
        LoadingButton,
        STErrorsDefault
    }
})
export default class PaymentSelectionView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    step = 2

    @Prop({ required: true })
    selectedMembers: MemberWithRegistrations[]

    @Prop({ default: false })
    reduced!: boolean

    loading = false
    errorBox: ErrorBox | null = null
    selectedPaymentMethod: PaymentMethod | null = null

    mounted() {
        this.selectedPaymentMethod = this.paymentMethods[0] ?? null
    }

    get paymentMethods() {
        return OrganizationManager.organization.meta.paymentMethods
    }

    getName(paymentMethod: PaymentMethod): string {
        switch (paymentMethod) {
            case PaymentMethod.Transfer: return "Overschrijving"
            case PaymentMethod.Bancontact: return "Bancontact"
        }
    }

    async goNext() {
        if (this.loading || !this.selectedPaymentMethod) {
            return
        }
        const session = SessionManager.currentSession!
        this.loading = true

        try {
            const groups = OrganizationManager.organization.groups

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
                    paymentMethod: this.selectedPaymentMethod
                }),
                decoder: RegisterResponse as Decoder<RegisterResponse>
            })

            if (response.data.paymentUrl) {
                window.location.href = response.data.paymentUrl;
                return;
            }

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
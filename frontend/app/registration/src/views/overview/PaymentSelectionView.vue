<template>
    <div class="boxed-view">
        <div class="st-view">
            <main v-if="paymentMethods.length > 1">
                <h1>Kies een betaalmethode</h1>

                <STErrorsDefault :error-box="errorBox" />

                <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />
            </main>
            <main v-else>
                <h1>Bevestig registratie</h1>
                <p>Heb je alle leden toegevoegd?</p>

                <STErrorsDefault :error-box="errorBox" />
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span v-if="willPay">Betalen</span>
                        <span v-else>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, PaymentHandler, PaymentSelectionList,Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Group, KeychainedResponse, MemberWithRegistrations, Payment, PaymentMethod, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup, TransferSettings } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
import RegistrationSuccessView from './RegistrationSuccessView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        PaymentSelectionList
    }
})
export default class PaymentSelectionView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    OrganizationManager = OrganizationManager
    step = 3

    @Prop({ required: true })
    selectedMembers: MemberWithRegistrations[]

    @Prop({ default: false })
    reduced!: boolean

    loading = false
    errorBox: ErrorBox | null = null
    selectedPaymentMethod: PaymentMethod | null = null

    mounted() {
        // this is needed because paymetn list is not loaded, and we need to select the first before continueing
        if (this.paymentMethods.length == 1) {
            this.selectedPaymentMethod = this.paymentMethods[0]
        }
    }

    get paymentMethods() {
        return OrganizationManager.organization.meta.paymentMethods
    }

    getSelectedGroups(member: MemberWithRegistrations): SelectedGroup[] {
        return member.getSelectedGroups(OrganizationManager.organization.groups)
    }

    getRegisterGroups(member: MemberWithRegistrations): Group[] {
        return this.getSelectedGroups(member).filter(g => !g.waitingList).map(g => g.group)
    }

    get willPay() {
        if (!this.selectedMembers.find(m => this.getRegisterGroups(m).length > 0)) {
            // only waiting list
            return false
        }
        return true;
    }

    get organization() {
        return this.OrganizationManager.organization
    }

    async goNext() {
        if (this.loading || !this.selectedPaymentMethod) {
            return
        }
        const session = SessionManager.currentSession!
        this.loading = true

        try {
            const groups = OrganizationManager.organization.groups
            const registerMembers = this.selectedMembers.flatMap(m => {
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
                        message: "Een gekozen leeftijdsgroep is niet meer geldig. Herlaad de pagina eens en probeer opnieuw."
                    })
                }

                return preferred.map(g => RegisterMember.create({
                    memberId: m.id,
                    groupId: g.group.id,
                    reduced: this.reduced,
                    waitingList: g.waitingList
                }))
            })

            const response = await session.authenticatedServer.request({
                method: "POST",
                path: "/user/members/register",
                body: RegisterMembers.create({
                    members: registerMembers,
                    paymentMethod: this.selectedPaymentMethod
                }),
                decoder: RegisterResponse as Decoder<RegisterResponse>
            })

            const payment = response.data.payment
            const registrations = await MemberManager.getRegistrationsWithMember(response.data.registrations)
            await MemberManager.setMembers(new KeychainedResponse({ data: response.data.members, keychainItems: []}))

            if (payment) {
                PaymentHandler.handlePayment({
                    server: session.authenticatedServer, 
                    organization: OrganizationManager.organization, 
                    payment, 
                    paymentUrl: response.data.paymentUrl, 
                    returnUrl: "https://"+window.location.hostname+"/payment?id="+encodeURIComponent(payment.id),
                    component: this,
                    transferSettings: OrganizationManager.organization.meta.transferSettings,
                    additionalReference: Formatter.uniqueArray(this.selectedMembers.map(r => r.details?.lastName ?? "?")).join(", "),
                }, (payment: Payment) => {
                    console.log("Success")
                    // success
                    this.loading = false

                    this.navigationController!.push(new ComponentWithProperties(RegistrationSuccessView, {
                        registrations
                    }))
                }, (payment: Payment) => {
                    console.log(payment)
                    // failure
                    this.loading = false
                })
                return;
            }

            this.loading = false
            
            this.show(new ComponentWithProperties(RegistrationSuccessView, {
                registrations
            }))
            
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

.payment-method-logo {
    max-height: 30px;
}

.payment-app-logo {
    height: 30px;
}

.payment-app-banner {
    display: flex;
    flex-direction: row;
    padding-top: 10px;

    > * {
        margin-right: 15px
    }
}

</style>
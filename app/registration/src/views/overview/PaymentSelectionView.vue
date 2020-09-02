<template>
    <div class="boxed-view">
        <div class="st-view">
            <main v-if="paymentMethods.length > 1">
                <h1>Kies een betaalmethode</h1>

                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="paymentMethod in paymentMethods" :key="paymentMethod" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio slot="left" name="choose-payment-method" v-model="selectedPaymentMethod" :value="paymentMethod"/>
                        <h2 :class="{ 'style-title-list': !!getDescription(paymentMethod) }">{{ getName(paymentMethod) }}</h2>
                        <p class="style-description-small" v-if="getDescription(paymentMethod)">{{ getDescription(paymentMethod) }}</p>

                        <div v-if="paymentMethod == 'Payconiq' && selectedPaymentMethod == paymentMethod" class="payment-app-banner">
                            <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/payconiq/app.svg"/>
                            <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/kbc/app.svg"/>
                            <img class="payment-app-logo" src="~@stamhoofd/assets/images/partners/ing/app.svg"/>
                        </div>

                        <img v-if="getLogo(paymentMethod)" slot="right" :src="getLogo(paymentMethod)" class="payment-method-logo"/>
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
                        <span v-if="willPay">Betalen</span>
                        <span v-else>Doorgaan</span>
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
import { MemberWithRegistrations, Group, RegisterMembers, RegisterMember, PaymentMethod, Payment, PaymentStatus, RegisterResponse, KeychainedResponse, RecordType, Record, SelectedGroup } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import TransferPaymentView from './TransferPaymentView.vue';
import { SessionManager } from '@stamhoofd/networking';
import { Decoder } from '@simonbackx/simple-encoding';
import RegistrationSuccessView from './RegistrationSuccessView.vue';
import PaymentPendingView from './PaymentPendingView.vue';
import PayconiqBannerView from './PayconiqBannerView.vue';
import PayconiqButtonView from './PayconiqButtonView.vue';
import payconiqLogo from "@stamhoofd/assets/images/partners/payconiq/payconiq-vertical-pos.svg"

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
    step = 3

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
            case PaymentMethod.Payconiq: return "Payconiq (aangeraden)"
            case PaymentMethod.Transfer: return "Via overschrijving"
            case PaymentMethod.Bancontact: return "Bancontact"
        }
    }

    getDescription(paymentMethod: PaymentMethod): string {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return "Betaal mobiel met de Payconiq by Bancontact app, de KBC-app of de ING-app."
            case PaymentMethod.Transfer: return ""
            case PaymentMethod.Bancontact: return ""
        }
    }

    getLogo(paymentMethod: PaymentMethod): string | null {
        switch (paymentMethod) {
            case PaymentMethod.Payconiq: return payconiqLogo
            case PaymentMethod.Transfer: return null
            case PaymentMethod.Bancontact: return null
        }
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

    getOS(): string {
        var userAgent = navigator.userAgent || navigator.vendor;

        if (/android/i.test(userAgent)) {
            return "android";
        }

        if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
            // Different sms protocol
            return "macOS-old";
        }

        // iOS detection from: http://stackoverflow.com/a/9039885/177710
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            return "iOS";
        }

        // iPad on iOS 13 detection
        if (navigator.userAgent.includes("Mac") && "ontouchend" in document) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().indexOf('MAC')>=0 ) {
            return "macOS";
        }

        if (navigator.platform.toUpperCase().indexOf('WIN')>=0 ) {
            return "windows";
        }

        if (navigator.platform.toUpperCase().indexOf('IPHONE')>=0 ) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().indexOf('ANDROID')>=0 ) {
            return "android";
        }

        return "unknown"
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

            const payment = response.data.payment

            if (response.data.paymentUrl) {
                let finishedHandler: (() => void) | null = null
                if (this.selectedPaymentMethod == PaymentMethod.Payconiq && payment) {
                    if (this.getOS() == "android" || this.getOS() == "iOS") {
                        const url = response.data.paymentUrl+"?returnUrl="+encodeURIComponent("https://"+window.location.hostname+"/payment?id="+encodeURIComponent(payment.id)) 
                        const href = document.createElement("a")
                        href.href = url
                        
                        let t = new Date().getTime()

                        const listener = function() {
                            if (document.hidden) {
                                console.log("Detected hidden")
                                // Payconiq app has opened
                                t -= 3000
                            }
                        };

                        const listen = document.addEventListener("visibilitychange", listener);
                        href.click();

                        window.setTimeout(() => {
                            if (!document.hidden) {
                                const t2 = new Date().getTime()

                                if (t2 - t <= 3000) {
                                    const component = new ComponentWithProperties(PayconiqButtonView, { 
                                        paymentUrl: url
                                    })
                                    this.present(component);
                                    finishedHandler = () => {
                                        (component.componentInstance() as any)?.pop()
                                    }
                                }
                            }
                            document.removeEventListener("visibilitychange", listener)
                        }, 200)
                       
                    } else {
                        // only on desktop
                        const component = new ComponentWithProperties(PayconiqBannerView, { 
                            paymentUrl: response.data.paymentUrl, 
                            initialPayment: payment,
                            presentingController: this.navigationController!
                         }).setDisplayStyle("sheet")
                        this.present(component)
                        this.loading = false;
                        return;
                    }
                    window.setTimeout(() => {
                        this.loading = false
                        this.show(new ComponentWithProperties(PaymentPendingView, {
                            paymentId: payment.id,
                            finishedHandler
                        }))
                    }, 2100)
                } else {
                    window.location.href = response.data.paymentUrl;
                }
                return;
            }
            MemberManager.setMembers(new KeychainedResponse({ data: response.data.members, keychainItems: []}))

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
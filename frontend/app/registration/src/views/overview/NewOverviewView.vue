<template>
    <LoadingView v-if="loadingBalance" />
    <div v-else class="st-view boxed">
        <STNavigationBar :large="true">
            <template slot="left">
                <OrganizationLogo :organization="organization" />
            </template>

            <template slot="right">
                <a v-if="organization.website" class="button text limit-space" :href="organization.website" target="_blank" rel="nofollow noreferrer noopener">
                    <span class="icon external" />
                    <span>Terug naar website</span>
                </a>
                <button class="primary button" type="button" @click="openCart">
                    <span class="icon basket" />
                    <span>{{ cart.count }}</span>
                </button>
            </template>
        </STNavigationBar>

        <div class="box">
            <main>
                <h1>Ledenportaal</h1>

                <p>Welkom op het ledenportaal van {{ organization.name }}.</p>

                <template v-if="cart.count || notYetPaidBalance || suggestedRegistrations.length">
                    <hr>
                    <h2>
                        Snelle acties
                    </h2>

                    <STList>
                        <STListItem v-if="cart.count" class="left-center right-stack" :selectable="true" @click="openCart">
                            <img slot="left" src="~@stamhoofd/assets/images/illustrations/cart.svg" class="style-illustration-img">
                            <h3 class="style-title-list">
                                Mandje afrekenen
                            </h3>
                            <p v-if="cart.price" class="style-description-small">
                                Betaal en bevestig je inschrijvingen.
                            </p>
                            <p v-else class="style-description-small">
                                Bevestig je inschrijvingen.
                            </p>

                            <span v-if="cart.price" slot="right" class="style-tag">{{ formatPrice(cart.price) }}</span>
                            <span slot="right" class="icon arrow-right-small gray" />
                        </STListItem>

                        <STListItem v-if="notYetPaidBalance" class="left-center" :selectable="true" @click="managePayments">
                            <img slot="left" src="~@stamhoofd/assets/images/illustrations/piggy-bank.svg" class="style-illustration-img">
                            <h3 class="style-title-list">
                                Betaal jouw openstaand bedrag
                            </h3>
                            <p class="style-description-small">
                                Je hebt een openstaand bedrag van {{ formatPrice(notYetPaidBalance) }}.
                            </p>

                            <span slot="right" class="icon arrow-right-small gray" />
                        </STListItem>

                        <STListItem v-for="suggestion in suggestedRegistrations" :key="suggestion.id" class="left-center hover-box member-registration-block" :selectable="true" @click="startRegistrationFlow(suggestion)">
                            <img v-if="!suggestion.group" slot="left" src="~@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img">
                            <template v-else slot="left">
                                <figure v-if="suggestion.group.squareImage" class="registration-image">
                                    <img :src="suggestion.group.squareImage.getPathForSize(100, 100)">
                                    <div>
                                        <span v-if="suggestion.waitingList" class="icon gray clock" />
                                    </div>
                                </figure>
                                <figure v-else class="registration-image">
                                    <figure>
                                        <span>{{ suggestion.group.settings.name.substr(0, 2) }}</span>
                                    </figure>
                                    <div>
                                        <span v-if="suggestion.waitingList" class="icon gray clock" />
                                    </div>
                                </figure>
                            </template>
                            <h3 class="style-title-list">
                                {{ getSuggestionTitle(suggestion) }}
                            </h3>
                            <p v-if="getSuggestionDescription(suggestion)" class="style-description-small">
                                {{ getSuggestionDescription(suggestion) }}
                            </p>

                            <span slot="right" class="icon arrow-right-small gray" />
                        </STListItem>
                    </STList>
                </template>

                <hr>
                <h2>Algemeen</h2>

                <STList class="illustration-list">    
                    <STListItem :selectable="true" class="left-center" @click="registerMember">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                        <h2 class="style-title-list">
                            Lid inschrijven
                        </h2>
                        <p class="style-description">
                            Schrijf een lid in
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="checkData">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/magnifier.svg">
                        <h2 class="style-title-list">
                            Gegevens en inschrijvingen nakijken
                        </h2>
                        <p class="style-description">
                            Pas gegevens aan en bekijk alle inschrijvingen.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="managePayments">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/creditcards.svg">
                        <h2 class="style-title-list">
                            Afrekeningen en openstaande rekening
                        </h2>
                        <p class="style-description">
                            Bekijk een overzicht van jouw recente betalingen en jouw openstaand bedrag.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="manageAccount">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/admin.svg">
                        <h2 class="style-title-list">
                            Account wijzigen
                        </h2>
                        <p class="style-description">
                            Wijzig jouw wachtwoord, e-mailadres van het account waarmee je inlogt.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>

                <template v-if="members.length">
                    <hr>
                    <h2>
                        Documenten
                    </h2>
                    <STList>
                        <STListItem class="left-center hover-box member-registration-block" :selectable="true">
                            <span slot="left" class="icon file-pdf red" />
                            <h3 class="style-title-list">
                                Fiscaal attest 2021
                            </h3>
                            <p class="style-description-small">
                                Je kan een belastingvermindering krijgen voor betaald lidgeld via dit attest.
                            </p>

                            <span slot="right" class="icon download gray" />
                        </STListItem>
                    </STList>
                </template>
            </main>
        </div>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LoadingView, OrganizationLogo, PromiseView, STList, STListItem, STNavigationBar } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { Group, MemberBalanceItem, MemberWithRegistrations, Payment, PaymentStatus, PaymentWithRegistrations, RegisterItem } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from "../../classes/CheckoutManager";
import { MemberManager } from "../../classes/MemberManager";
import { OrganizationManager } from "../../classes/OrganizationManager";
import AccountSettingsView from "../account/AccountSettingsView.vue";
import PaymentsView from "../account/PaymentsView.vue";
import CartView from "../checkout/CartView.vue";
import GroupView from "../groups/GroupView.vue";
import MemberChooseGroupsView from "../members/MemberChooseGroupsView.vue";
import CheckDataView from "./CheckDataView.vue";
import ChooseMemberView from "./register-flow/ChooseMemberView.vue";

@Component({
    components: {
        STNavigationBar,
        OrganizationLogo,
        STList,
        STListItem,
        LoadingView
    }
})
export default class NewOverviewView extends Mixins(NavigationMixin){
    loadingBalance = false
    balanceItems: MemberBalanceItem[] = []
    MemberManager = MemberManager

    created() {
        this.loadBalance().catch(console.error)
    }

    mounted() {
        const parts =  UrlHelper.shared.getParts()
        const searchParams = UrlHelper.shared.getSearchParams()
        UrlHelper.setUrl("/")
        document.title = "Ledenportaal - " + this.organization.name
        

        if (parts.length == 1 && parts[0] == 'payment' && searchParams.get("id")) {
            UrlHelper.shared.clear()

            const paymentId = searchParams.get("id")

            const session = SessionManager.currentSession!
            const component = new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        const PaymentPendingView = (await import(/* webpackChunkName: "Checkout" */ "@stamhoofd/components/src/views/PaymentPendingView.vue")).default
                        return new ComponentWithProperties(PaymentPendingView, {
                            server: session.authenticatedServer,
                            paymentId,
                            finishedHandler: async function(this: NavigationMixin, payment: Payment | null) {
                                if (payment && payment.status == PaymentStatus.Succeeded) {
                                    const RegistrationSuccessView = (await import(/* webpackChunkName: "Checkout" */ "../checkout/RegistrationSuccessView.vue")).default
                                    const response = await session.authenticatedServer.request({
                                        method: "GET",
                                        path: "/payments/"+payment.id+"/registrations",
                                        decoder: PaymentWithRegistrations as Decoder<PaymentWithRegistrations>
                                    })
                                    const registrations = response.data.registrations

                                    this.show({
                                        components: [
                                            new ComponentWithProperties(RegistrationSuccessView, {
                                                registrations
                                            })
                                        ], 
                                        replace: 1, 
                                        force: true
                                    })

                                } else {
                                    UrlHelper.setUrl("/")
                                    this.dismiss({ force: true })
                                    new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.", "error").addCloseButton().show()
                                }
                            }
                        })
                    }
                })
            })
            this.present({
                components: [component],
                animated: false,
                modalDisplayStyle: "popup"
            })
        }
    }

    async loadBalance() {
        this.loadingBalance = true;
        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: 'GET',
                path: '/balance',
                decoder: new ArrayDecoder(MemberBalanceItem as Decoder<MemberBalanceItem>)
            })
            this.balanceItems = response.data
        } catch (e) {
            // Fail silently here
            console.error(e);
        }
        this.loadingBalance = false;
    }

    get notYetPaidBalance() {
        return MemberBalanceItem.getOutstandingBalance(this.balanceItems).totalOpen
    }

    get organization() {
        return OrganizationManager.organization
    }

    get members() {
        if (MemberManager.members) {
            return MemberManager.members
        }
        return []
    }

    get cart() {
        return CheckoutManager.cart
    }

    get suggestedRegistrations(): {group?: Group, member: MemberWithRegistrations, waitingList: boolean, id: string}[] {
        const suggestions: {group?: Group, member: MemberWithRegistrations, waitingList: boolean, id: string}[] = []
        const groups = OrganizationManager.organization.availableGroups

        // todo: ignore all members with zero current or past registrations

        for (const member of this.members) {
            for (const group of groups) {
                const canRegister = member.canRegister(group, MemberManager.members ?? [], OrganizationManager.organization.meta.categories, CheckoutManager.cart.items);
                
                // Check in cart
                const item = new RegisterItem(member, group, { reduced: false, waitingList: canRegister.waitingList })
                if (CheckoutManager.cart.hasItem(item)) {
                    continue;
                }
                
                if (!canRegister.closed) {
                    suggestions.push({ group, member, waitingList: canRegister.waitingList, id: member.id })
                } else {
                    // Add waiting list
                    if (canRegister.waitingList) {
                        suggestions.push({ group, member, waitingList: true, id: member.id })
                    }
                }
            }
        }

        // If a given member can register for multiple groups, only show one and remove the group
        const filteredSuggestions: {group?: Group, member: MemberWithRegistrations, waitingList: boolean, id: string}[] = []
        for (const suggestion of suggestions) {
            const existing = filteredSuggestions.find(s => s.member.id == suggestion.member.id)
            if (existing) {
                existing.group = undefined
                existing.waitingList = existing.waitingList && suggestion.waitingList
                continue
            }
            filteredSuggestions.push(suggestion)
        }

        return filteredSuggestions
    }

    getSuggestionTitle(suggestion: {group?: Group, member: MemberWithRegistrations, waitingList: boolean}) {
        if (suggestion.waitingList) {
            if (suggestion.group) {
                return suggestion.member.firstName + " inschrijven op wachtlijst voor "+suggestion.group.settings.name
            }
            return  suggestion.member.firstName + " inschrijven op wachtlijst"
        }
        if (suggestion.group) {
            return suggestion.member.firstName + " inschrijven voor "+suggestion.group.settings.name
        }
        return suggestion.member.firstName + " inschrijven"
    }

    getSuggestionDescription(suggestion: {group?: Group, member: MemberWithRegistrations, waitingList: boolean}) {
        if (suggestion.group && suggestion.group.settings.registrationEndDate) {
            const group = suggestion.group;
            return "Inschrijvingen sluiten op " + Formatter.dateTime(group.settings.registrationEndDate)
        }
        return ""
    }

    startRegistrationFlow({group, member}: {group?: Group, member: MemberWithRegistrations}) {
        if (!group) {
            this.present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(MemberChooseGroupsView, {
                            member
                        })
                    })
                ],
                modalDisplayStyle: "popup"
            })
            return
        }

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(GroupView, {
                        group,
                        member
                    })
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    openCart() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(CartView, {})
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    registerMember() {
        this.present({
            components: [
                new ComponentWithProperties(
                    NavigationController,
                    {
                        root: new ComponentWithProperties(ChooseMemberView, {})
                    }
                )
            ],
            modalDisplayStyle: "popup"
        })
    }

    checkData() {
        this.present({
            components: [
                new ComponentWithProperties(
                    NavigationController,
                    {
                        root: new ComponentWithProperties(CheckDataView, {})
                    }
                )
            ],
            modalDisplayStyle: "popup"
        })
    }

    manageAccount() {
        this.present({
            components: [
                new ComponentWithProperties(
                    NavigationController,
                    {
                        root: new ComponentWithProperties(AccountSettingsView, {})
                    }
                )
            ],
            modalDisplayStyle: "popup"
        })
    }

    managePayments() {
        this.present({
            components: [
                new ComponentWithProperties(
                    NavigationController,
                    {
                        root: new ComponentWithProperties(PaymentsView, {})
                    }
                )
            ],
            modalDisplayStyle: "popup"
        })
    }
}
</script>


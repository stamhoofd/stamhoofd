<template>
    <LoadingView v-if="loadingBalance" />
    <div v-else class="st-view box-shade">
        <STNavigationBar :large="true">
            <template #left>
                <OrganizationLogo :organization="organization" />
            </template>

            <template #right>
                <a v-if="organization.website" class="button text limit-space" :href="organization.website" target="_blank" rel="nofollow noreferrer noopener">
                    <span class="icon external" />
                    <span>Terug naar website</span>
                </a>
                <button class="primary button" type="button" @click="openCart(true)">
                    <span class="icon basket" />
                    <span>{{ cart.count }}</span>
                </button>
            </template>
        </STNavigationBar>

        <main class="center">
            <div class="box">
                <main>
                    <h1>Ledenportaal</h1>
                    <p v-if="members.length == 0">
                        Welkom op het ledenportaal van {{ organization.name }}. Momenteel heb je nog geen leden ingeschreven.
                    </p>
                    <p v-else>
                        Welkom op het ledenportaal van {{ organization.name }}.
                    </p>

                    <p v-if="!isAcceptingNewMembers && members.length == 0 && !isAcceptingExistingMembers" class="warning-box">
                        Je kan op dit moment geen nieuwe leden inschrijven.
                    </p>
                    <p v-else-if="!isAcceptingNewMembers && members.length == 0" class="warning-box">
                        Je kan op dit moment geen nieuwe leden inschrijven. Kijk eventueel na of je met het juiste e-mailadres bent ingelogd als je een bestaand lid wilt wijzigen of inschrijven.
                    </p>

                    <template v-if="members.length == 0 && isAcceptingNewMembers">
                        <button class="button primary" type="button" @click="registerMember">
                            <span class="icon edit" />
                            <span>Schrijf een lid in</span>
                        </button>
                    </template>
                    <template v-if="cart.count || notYetPaidBalance > 0 || suggestedRegistrations.length || membersWithMissingData.length">
                        <hr>
                        <h2>
                            Snelle acties
                        </h2>

                        <STList>
                            <STListItem v-if="cart.count" class="left-center right-stack" :selectable="true" @click="openCart(true)">
                                <template #left><img src="@stamhoofd/assets/images/illustrations/cart.svg" class="style-illustration-img"></template>
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
                                <template #right><span class="icon arrow-right-small gray" /></template>
                            </STListItem>

                            <STListItem v-for="member of membersWithMissingData" :key="'missing'+member.id" class="left-center" :selectable="true" @click="fillInMemberMissingData(member)">
                                <template #left><img src="@stamhoofd/assets/images/illustrations/health-data.svg" class="style-illustration-img"></template>
                                <h3 class="style-title-list">
                                    Vul ontbrekende gegevens aan van {{ member.details.firstName }}
                                </h3>
                                <p class="style-description-small">
                                    Enkele gegevens van {{ member.details.firstName }} ontbreken. Vul ze hier in.
                                </p>

                                <template #right><span class="icon arrow-right-small gray" /></template>
                            </STListItem>

                            <STListItem v-if="notYetPaidBalance > 0" class="left-center" :selectable="true" @click="managePayments(true)">
                                <template #left><img src="@stamhoofd/assets/images/illustrations/piggy-bank.svg" class="style-illustration-img"></template>
                                <h3 class="style-title-list">
                                    Betaal jouw openstaand bedrag
                                </h3>
                                <p class="style-description-small">
                                    Je hebt een openstaand bedrag van {{ formatPrice(notYetPaidBalance) }}.
                                </p>

                                <template #right><span class="icon arrow-right-small gray" /></template>
                            </STListItem>

                            <STListItem v-for="suggestion in suggestedRegistrations" :key="suggestion.id" class="left-center hover-box member-registration-block" :selectable="true" @click="startRegistrationFlow(suggestion)">
                                <img v-if="!suggestion.group" slot="left" src="@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img">
                                <template v-else slot="left">
                                    <figure v-if="suggestion.group.squareImage" class="registration-image">
                                        <img :src="suggestion.group.squareImage.getPathForSize(100, 100)">
                                        <div>
                                            <span v-if="suggestion.waitingList" class="icon gray clock" />
                                        </div>
                                    </figure>
                                    <figure v-else class="registration-image">
                                        <figure>
                                            <span>{{ suggestion.group.settings.getShortCode(2) }}</span>
                                        </figure>
                                        <div>
                                            <span v-if="suggestion.waitingList" class="icon gray clock" />
                                        </div>
                                    </figure>
                                </template>
                                <h3 class="style-title-list">
                                    {{ suggestion.title }}
                                </h3>
                                <p v-if="suggestion.description" class="style-description-small">
                                    {{ suggestion.description }}
                                </p>

                                <template #right><span class="icon arrow-right-small gray" /></template>
                            </STListItem>
                        </STList>
                    </template>

                    <hr>
                    <h2>Algemeen</h2>

                    <STList class="illustration-list">    
                        <STListItem v-if="members.length || isAcceptingNewMembers" :selectable="true" class="left-center" @click="registerMember">
                            <template #left><img src="@stamhoofd/assets/images/illustrations/edit-data.svg"></template>
                            <h2 class="style-title-list">
                                Lid inschrijven
                            </h2>
                            <p class="style-description">
                                Schrijf een lid in.
                            </p>
                            <template #right><span class="icon arrow-right-small gray" /></template>
                        </STListItem>

                        <STListItem v-if="members.length" :selectable="true" class="left-center" @click="checkData">
                            <template #left><img src="@stamhoofd/assets/images/illustrations/magnifier.svg"></template>
                            <h2 class="style-title-list">
                                Gegevens en inschrijvingen nakijken
                            </h2>
                            <p class="style-description">
                                Pas gegevens aan en bekijk alle inschrijvingen.
                            </p>
                            <template #right><span class="icon arrow-right-small gray" /></template>
                        </STListItem>

                        <STListItem v-if="members.length" :selectable="true" class="left-center" @click="managePayments(true)">
                            <template #left><img src="@stamhoofd/assets/images/illustrations/creditcards.svg"></template>
                            <h2 class="style-title-list">
                                Afrekeningen en openstaande rekening
                            </h2>
                            <p class="style-description">
                                Bekijk een overzicht van jouw recente betalingen en jouw openstaand bedrag.
                            </p>
                            <template #right><span class="icon arrow-right-small gray" /></template>
                        </STListItem>

                        <STListItem :selectable="true" class="left-center" @click="manageAccount">
                            <template #left><img src="@stamhoofd/assets/images/illustrations/admin.svg"></template>
                            <h2 class="style-title-list">
                                Account wijzigen
                            </h2>
                            <p class="style-description">
                                Wijzig het wachtwoord of e-mailadres van het account waarmee je inlogt.
                            </p>
                            <template #right><span class="icon arrow-right-small gray" /></template>
                        </STListItem>
                    </STList>

                    <template v-if="documents.length">
                        <hr>
                        <h2>
                            Documenten
                        </h2>
                        <STList>
                            <STListItem v-for="document of documents" :key="document.id" class="left-center hover-box member-registration-block" :selectable="true" @click="downloadDocument(document)">
                                <template #left><span class="icon file-pdf red" /></template>
                                <h3 class="style-title-list">
                                    {{ document.data.name }}
                                </h3>
                                <p class="style-description-small">
                                    {{ document.data.description }}
                                </p>
                                <span v-if="document.status === 'MissingData'" class="style-tag error">Onvolledig</span>

                                <template #right>
                                    <Spinner v-if="isDocumentDownloading(document)" class="gray" />
                                    <span v-else class="icon download gray" />
                                </template>
                            </STListItem>
                        </STList>
                    </template>
                </main>
            </div>

            <LegalFooter :organization="organization" />
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LegalFooter, LoadingView, OrganizationLogo, PromiseView, Spinner, STList, STListItem, STNavigationBar, STToolbar, Toast, AccountSettingsView } from "@stamhoofd/components";
import { downloadDocument } from "@stamhoofd/document-helper";
import { UrlHelper } from "@stamhoofd/networking";
import { Document, DocumentStatus, MemberBalanceItem, MemberWithRegistrations, Payment, PaymentStatus, PaymentWithRegistrations } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { Suggestion, SuggestionBuilder } from "../../classes/SuggestionBuilder";
import PaymentsView from "../account/PaymentsView.vue";
import CartView from "../checkout/CartView.vue";
import { createMemberComponent } from "../members/details/createMemberComponent";
import { EditMemberStepsManager } from "../members/details/EditMemberStepsManager";
import CheckDataView from "./CheckDataView.vue";
import ChooseMemberView from "./register-flow/ChooseMemberView.vue";

@Component({
    components: {
        STNavigationBar,
        OrganizationLogo,
        STList,
        STListItem,
        LoadingView,
        STToolbar,
        Spinner,
        LegalFooter
    }
})
export default class NewOverviewView extends Mixins(NavigationMixin){
    loadingBalance = false

    created() {
        this.updateCartAndBalance().catch(console.error)
    }

    get balanceItems() {
        return this.$checkoutManager.balanceItems ?? []
    }

    get isAcceptingNewMembers() {
        return this.organization.isAcceptingNewMembers(!!this.$context.user?.permissions)
    }

    get isAcceptingExistingMembers() {
        return this.organization.isAcceptingExistingMembers(!!this.$context.user?.permissions)
    }

    get documents() {
        return this.$memberManager.documents ?? []
    }

    mounted() {
        const parts =  UrlHelper.shared.getParts()
        const searchParams = UrlHelper.shared.getSearchParams()
        UrlHelper.setUrl("/")
        document.title = "Ledenportaal - " + this.organization.name

        if (parts.length >= 1 && parts[0] == 'cart') {
            if (parts.length === 1) {
                UrlHelper.shared.clear()
            }
            this.openCart(false)
        } else if (parts.length >= 1 && parts[0] == 'payments') {
            if (parts.length === 1) {
                UrlHelper.shared.clear()
            }
            this.managePayments(false)
        } else if (parts.length == 1 && parts[0] == 'payment' && searchParams.get("id")) {
            UrlHelper.shared.clear()

            const paymentId = searchParams.get("id")
            const cancel = searchParams.get("cancel") === "true"

            const session = this.$context
            const component = new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        const PaymentPendingView = (await import(/* webpackChunkName: "Checkout" */ "@stamhoofd/components/src/views/PaymentPendingView.vue")).default
                        return new ComponentWithProperties(PaymentPendingView, {
                            server: session.authenticatedServer,
                            paymentId,
                            cancel,
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
                                    new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.").addCloseButton().show()
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

    async updateCartAndBalance() {
        this.loadingBalance = true;
        try {
            await this.$checkoutManager.recalculateCart(false)
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
        return this.$organization
    }

    get members() {
        if (this.$memberManager.members) {
            return this.$memberManager.members
        }
        return []
    }

    get membersWithMissingData() {
        return this.members.filter(member => member.activeRegistrations.length && this.getStepsManagerMissingData(member).hasSteps())
    }

    getStepsManagerMissingData(member: MemberWithRegistrations) {
        const items = this.$checkoutManager.cart.items.filter(item => item.memberId === member.id)
        const steps = EditMemberStepsManager.getAllSteps(this.$context, false, true)

        const stepManager = new EditMemberStepsManager(
            this.$memberManager,
            steps, 
            items,
            member,
            async (component: NavigationMixin) => {
                component.dismiss({ force: true })
                return Promise.resolve()
            }
        )
        return stepManager
    }

    async fillInMemberMissingData(member: MemberWithRegistrations) {
        const stepManager = this.getStepsManagerMissingData(member)
        const component = await stepManager.getFirstComponent()

        if (!component) {
            // Weird
        } else {
            this.present(new ComponentWithProperties(NavigationController, {
                root: component
            }).setDisplayStyle("popup"))
        }
    }

    get cart() {
        return this.$checkoutManager.cart
    }

    get suggestedRegistrations(): Suggestion[] {
        return SuggestionBuilder.getSuggestions(this.$checkoutManager, this.members)
    }

    startRegistrationFlow(suggestion: Suggestion) {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: suggestion.getComponent()
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    openCart(animated = true) {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(CartView, {})
                })
            ],
            modalDisplayStyle: "popup",
            animated
        })
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    async registerMember() {
        if (this.members.length == 0) {
            const component = await createMemberComponent(this.$memberManager)
            this.present({
                components: [
                    new ComponentWithProperties(
                        NavigationController,
                        {
                            root: component
                        }
                    )
                ],
                modalDisplayStyle: "popup"
            })
            return;
        }
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

    managePayments(animated = true) {
        this.present({
            components: [
                new ComponentWithProperties(
                    NavigationController,
                    {
                        root: new ComponentWithProperties(PaymentsView, {})
                    }
                )
            ],
            modalDisplayStyle: "popup",
            animated
        })
    }

    downloadingDocuments: Document[] = []

    async downloadDocument(document: Document) {
        if (this.isDocumentDownloading(document)) {
            return
        }
        if (document.status === DocumentStatus.MissingData) {
            new Toast('Dit document kan niet gedownload worden omdat er nog gegevens ontbreken. Vul eerst alle ontbrekende gegevens aan en contacteer ons indien het probleem nog niet is verholpen.', 'error red').show()
            return
        }
        this.downloadingDocuments.push(document)
        try {
            await downloadDocument(this.$context, document);
        } catch (e) {
            console.error(e);
        }
        this.downloadingDocuments = this.downloadingDocuments.filter(d => d.id != document.id)
    }

    isDocumentDownloading(document: Document) {
        return !!this.downloadingDocuments.find(d => d.id == document.id)
    }
}
</script>


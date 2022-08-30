<template>
    <section>
        <main>
            <h1>Afrekeningen</h1>
            <p>Hier kan je de betaalstatus van jouw inschrijvingen opvolgen.</p>

            <STErrorsDefault :error-box="errorBox" />

            <p v-if="payments.length === 0 && !loading" class="info-box">
                Er zijn momenteel nog geen afrekeningen beschikbaar voor jouw account
            </p>

            <STList v-else>
                <STListItem v-for="payment in payments" :key="payment.id" class="right-stack" :selectable="canOpenPayment(payment)" @click="openPayment(payment)">
                    <span slot="left" class="icon card" />

                    <h2 class="style-title-list">
                        {{ getPaymentPeriod(payment) }}
                    </h2>
                    <p class="style-description-small pre-wrap" v-text="getPaymentDescription(payment)" />
                    <p class="style-description-small">
                        {{ paymentMethodName(payment) }}
                    </p>

                    <template slot="right">
                        <span>{{ payment.price | price }}</span>
                        <span v-if="payment.status == 'Succeeded'" class="icon green success" />
                        <span v-else-if="canOpenPayment(payment)" class="icon arrow-right" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </section>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STList, STListItem, TransferPaymentView } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { Payment, PaymentMethod, PaymentMethodHelper, PaymentStatus } from "@stamhoofd/structures";
import { MemberBalanceItem } from "@stamhoofd/structures/esm/dist";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';

@Component({
    components: {
        STList,
        STListItem,
        STErrorsDefault
    },
    filters: {
        price: Formatter.price
    }
})
export default class PaymentsView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    loading = true
    balanceItems: MemberBalanceItem[] = []
    errorBox: ErrorBox | null = null

    async load() {
        this.loading = true;
        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: 'GET',
                path: '/balance',
                decoder: new ArrayDecoder(MemberBalanceItem as Decoder<MemberBalanceItem>)
            })
            this.balanceItems = response.data
        } catch (e) {
            this.errorBox = new ErrorBox(e);
        }
        this.loading = false;
    }

    /**
     * Return members that are currently registered in
     */
    get registeredMembers() {
        if (!this.members) {
            return []
        }
        return this.members.filter(m => m.groups.length > 0)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get rootCategory() {
        return this.organization.categoryTree
    }

    logout() {
        if (SessionManager.currentSession && SessionManager.currentSession.isComplete()) {
            SessionManager.currentSession.logout()
            return;
        }
    }

    getPaymentPeriod(payment: Payment) {
        return Formatter.capitalizeFirstLetter(Formatter.month(payment.createdAt.getMonth() + 1)) + " " + payment.createdAt.getFullYear()
    }

    paymentMethodName(payment: Payment) {
        const method = payment.method ?? PaymentMethod.Unknown
        const succeeded = payment.status === PaymentStatus.Succeeded

        if (method === PaymentMethod.Transfer) {
            return succeeded ? "Betaald via overschrijving" : "Te betalen via overschrijving"
        }

        if (method === PaymentMethod.PointOfSale) {
            return succeeded ? "Ter plaatse betaald" : "Ter plaatse te betalen"
        }

        if (method === PaymentMethod.Unknown) {
            return succeeded ? "Betaald" : "Te betalen"
        }

        if (succeeded) {
            return "Betaald via "+PaymentMethodHelper.getName(method)
        }

        return "Betaald via "+PaymentMethodHelper.getName(method)
    }

    getPaymentDescription(payment: Payment) {
        const balanceItems = this.balanceItems.filter(i => !!i.payments.find(p => p => p.payment.id === payment.id))
        return balanceItems.map(b => b.description).join("\n");
    }

    get payments() {
        const payments: Map<string, Payment> = new Map()
        for (const balanceItem of this.balanceItems) {
            for (const balanceItemPayment of balanceItem.payments) {
                const existing = payments.get(balanceItemPayment.payment.id)
                if (!existing) {
                    payments.set(balanceItemPayment.payment.id, balanceItemPayment.payment)
                }
            }
        }
        return Array.from(payments.values())
    }

    get members() {
        if (MemberManager.members) {
            return MemberManager.members
        }
        return []
    }

    mounted() {
        UrlHelper.setUrl("/")
        this.load().catch(console.error)
    }

    canOpenPayment(payment: Payment) {
        return payment.method == PaymentMethod.Transfer
    }

    openPayment(payment: Payment) {
        if (!this.canOpenPayment(payment)) {
            return;
        }
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(TransferPaymentView, {
                type: "registration",
                organization: OrganizationManager.organization,
                payment,
                settings: OrganizationManager.organization.meta.transferSettings,
                isPopup: true
            })
        }).setDisplayStyle("popup"))
    }
}
</script>
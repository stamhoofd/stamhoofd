<template>
    <div class="st-view payments-view">
        <STNavigationBar :pop="canPop" :dismiss="canDismiss" title="Afrekeningen" />
        <main>
            <h1>Afrekeningen</h1>
            <p>Hier kan je jouw betalingen opvolgen.</p>

            <STErrorsDefault :error-box="errorBox" />

            <LoadingView v-if="loading" />

            <p v-if="payments.length === 0 && !loading" class="info-box">
                Er zijn momenteel nog geen afrekeningen beschikbaar voor jouw account
            </p>

            <template v-if="outstandingItems.length">
                <hr>
                <h2>Openstaand</h2>

                <STList>
                    <STListItem v-for="item in outstandingItems" :key="item.id">
                        <h3 class="style-title-list">
                            {{ item.description }}
                        </h3>
                        <p v-if="item.memberId && getMember(item.memberId) && multipleMembers" class="style-description-small">
                            {{ getMember(item.memberId).name }}
                        </p>
                        <p class="style-description-small">
                            {{ formatDate(item.createdAt) }}
                        </p>
                        <p class="style-description-small">
                            {{ formatPrice(item.price) }}
                        </p>
                        <template slot="right">
                            <span v-if="item.pricePaid === item.price" class="style-tag success">Betaald</span>
                            <span v-else-if="item.pricePaid > 0" class="style-tag warn">{{ formatPrice(item.pricePaid) }} betaald</span>
                            <span v-else-if="!item.hasPendingPayment" class="style-tag">Openstaand</span>
                            <span v-else class="style-tag warn">In verwerking</span>
                        </template>
                    </STListItem>
                </STList>

                <div class="pricing-box">
                    <STList>
                        <STListItem>
                            Totaal te betalen

                            <template slot="right">
                                {{ formatPrice(outstandingBalance.total) }}
                            </template>
                        </STListItem>
                        <STListItem v-if="outstandingBalance.totalPending > 0 && outstandingBalance.totalOpen > 0">
                            Waarvan in verwerking

                            <template slot="right">
                                {{ formatPrice(outstandingBalance.totalPending) }}
                            </template>
                        </STListItem>
                    </STList>
                </div>
            </template>

            <template v-if="pendingPayments.length > 0">
                <hr>
                <h2>In verwerking</h2>
                <p>Bij betalingen via overschrijving moeten we de betaling manueel markeren als betaald zodra we ze ontvangen op onze rekening. Het kan even duren voor je hiervan een bevestiging ontvangt.</p>

                <STList>
                    <STListItem v-for="payment of pendingPayments" :key="payment.id" :selectable="true" @click="openPayment(payment)">
                        <h3 class="style-title-list">
                            {{ getPaymentMethodName(payment.method) }}
                        </h3>
                        <p class="style-description-small">
                            Aangemaakt op {{ formatDate(payment.createdAt) }}
                        </p>

                        <span slot="right">{{ formatPrice(payment.price) }}</span>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>
            </template>

            <template v-if="succeededPayments.length > 0">
                <hr>
                <h2>Betalingen</h2>

                <STList>
                    <STListItem v-for="payment of succeededPayments" :key="payment.id" :selectable="true" @click="openPayment(payment)">
                        <h3 class="style-title-list">
                            {{ getPaymentMethodName(payment.method) }}
                        </h3>
                        <p v-if="formatDate(payment.createdAt) !== formatDate(payment.paidAt)" class="style-description-small">
                            Aangemaakt op {{ formatDate(payment.createdAt) }}
                        </p>
                        <p class="style-description-small">
                            Betaald op {{ formatDate(payment.paidAt) }}
                        </p>

                        <span slot="right">{{ formatPrice(payment.price) }}</span>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>
            </template>
        </main>
        <STToolbar v-if="outstandingBalance.totalOpen > 0">
            <button slot="right" class="button primary full" type="button" @click="startPayment">
                <span class="icon card" />
                <span>Betalen</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingView,STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { MemberBalanceItem, Payment, PaymentMethod, PaymentMethodHelper, PaymentStatus } from "@stamhoofd/structures";
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
import AddBalanceItemsToCartView from "./AddBalanceItemsToCartView.vue";
import PaymentView from "./PaymentView.vue";



@Component({
    components: {
        STList,
        STListItem,
        STErrorsDefault,
        STNavigationBar,
        STToolbar,
        LoadingView
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

    get pendingPayments() {
        const payments = new Map<string, Payment>()
        for (const item of this.balanceItems) {
            for (const payment of item.payments) {
                if (payment.payment.isPending) {
                    payments.set(payment.payment.id, payment.payment)
                }
            }
        }
        return [...payments.values()].sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
    }

    get multipleMembers() {
        return (MemberManager.members?.length ?? 0) > 1
    }

    getMember(memberId: string) {
        return MemberManager.members?.find(m => m.id === memberId)
    }

    get succeededPayments() {
        const payments = new Map<string, Payment>()
        for (const item of this.balanceItems) {
            for (const payment of item.payments) {
                if (payment.payment.isSucceeded) {
                    payments.set(payment.payment.id, payment.payment)
                }
            }
        }
        return [...payments.values()].sort((a, b) => Sorter.byDateValue(a.paidAt ?? a.createdAt, b.paidAt ?? b.createdAt))
    }

    get outstandingBalance() {
        return MemberBalanceItem.getOutstandingBalance(this.balanceItems)
    }

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

    getPaymentPeriod(payment: Payment) {
        return Formatter.capitalizeFirstLetter(Formatter.month(payment.createdAt.getMonth() + 1)) + " " + payment.createdAt.getFullYear()
    }

    formatDate(date: Date) {
        return Formatter.date(date, true)
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    getPaymentMethodName(method: PaymentMethod) {
        return PaymentMethodHelper.getNameCapitalized(method);
    }

    get outstandingItems() {
        return this.balanceItems.filter(i => !i.isPaid).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
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
        UrlHelper.setUrl("/payments")
        this.load().catch(console.error)
    }

    canOpenPayment(payment: Payment) {
        return payment.method == PaymentMethod.Transfer
    }

    openPayment(payment: Payment) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PaymentView, {
                initialPayment: payment,
            })
        }).setDisplayStyle("popup"))
    }

    startPayment() {
        this.show(new ComponentWithProperties(AddBalanceItemsToCartView, {
            balanceItems: this.balanceItems
        }))
    }
}
</script>

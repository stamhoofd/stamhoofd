<template>
    <div class="member-payments-view">
        <main class="container">
            <STErrorsDefault :error-box="errorBox" />
            <Spinner v-if="loadingPayments" />

            <template v-else>
                <p v-if="member.details.requiresFinancialSupport && member.details.requiresFinancialSupport.value" class="warning-box">
                    {{ financialSupportWarningText }}
                </p>

                <p v-if="filteredBalanceItems.length == 0" class="info-box">
                    Geen openstaande rekening
                </p>
                
                <STList>
                    <STListItem v-for="item in filteredBalanceItems" :key="item.id" :selectable="hasWrite" @click="editBalanceItem(item)">
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

                <div v-if="filteredBalanceItems.length > 0" class="style-pricing-box">
                    <STList>
                        <STListItem v-if="outstandingBalance.total >= 0">
                            Totaal te betalen

                            <template slot="right">
                                {{ formatPrice(outstandingBalance.total) }}
                            </template>
                        </STListItem>
                        <STListItem v-else-if="outstandingBalance.totalPending > 0">
                            Totaal te betalen

                            <template slot="right">
                                {{ formatPrice(0) }}
                            </template>
                        </STListItem>
                        <STListItem v-if="outstandingBalance.totalPending > 0">
                            Waarvan in verwerking

                            <template slot="right">
                                {{ formatPrice(outstandingBalance.totalPending) }}
                            </template>
                        </STListItem>

                        <STListItem v-if="outstandingBalance.total < 0">
                            Totaal terug te betalen

                            <template slot="right">
                                {{ formatPrice(outstandingBalance.total) }}
                            </template>
                        </STListItem>
                    </STList>
                </div>

                <button v-if="hasWrite" type="button" class="button text" @click="createBalanceItem">
                    <span class="icon add" />
                    <span>Bedrag aanrekenen</span>
                </button>

                <button v-if="hasWrite && ((outstandingBalance.total - outstandingBalance.totalPending) > 0 || outstandingBalance.total < 0)" type="button" class="button text" @click="createPayment">
                    <span class="icon card" />
                    <span>Betaling/terugbetaling registreren</span>
                </button>

                <template v-if="outstandingBalance.total > 0">
                    <hr>
                    <h2>Hoe openstaand bedrag betalen?</h2>
                    <p>Leden kunnen hun openstaand bedrag betalen door naar het ledenportaal te gaan. Bovenaan zullen ze bij 'snelle acties' een knop zien waarmee ze hun openstaand bedrag kunnen betalen (je kan een e-mail sturen met een inlogknop om naar het ledenportaal te gaan).</p>
                    <p v-if="pendingPayments.length > 0" class="style-description-block">
                        Opgelet, het deel dat in verwerking is kan niet betaald worden via het ledenportaal. Je kan wel de betalingen die in verwerking zijn annuleren zodat ze via een andere betaalmethode betaald kunnen worden via het ledenportaal. Bijvoorbeeld een overschrijving die al lang niet betaald werd kan je annuleren om vervolgens een nieuw betaalverzoek te versturen van het openstaande bedrag.
                    </p>
                    <p v-if="(outstandingBalance.total - outstandingBalance.totalPending) !== 0" class="style-description-block">
                        Je kan zelf ook manueel een betaling toevoegen (bv. als er ter plaatse werd betaald, of via een overschrijving die niet in het systeem is opgenomen) via de knop 'Betaling/terugbetaling registreren' hierboven.
                    </p>
                </template>
               
                <template v-if="pendingPayments.length > 0">
                    <hr>
                    <h2>In verwerking</h2>
                    <p>Het kan dat het openstaande bedrag eerder betaald werd via overschrijving. In dit geval weten we nog niet of die echt is uitgevoerd tot jullie het bedrag ontvangen op jullie rekening. Je kan deze overschrijvingen hier markeren als betaald of annuleren.</p>

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
                                <template v-if="payment.price < 0">
                                    (terugbetaling)
                                </template>
                            </h3>
                            <p v-if="formatDate(payment.createdAt) !== formatDate(payment.paidAt)" class="style-description-small">
                                Aangemaakt op {{ formatDate(payment.createdAt) }}
                            </p>
                            <p v-if="payment.price >= 0" class="style-description-small">
                                Betaald op {{ formatDate(payment.paidAt) }}
                            </p>
                            <p v-else class="style-description-small">
                                Terugbetaald op {{ formatDate(payment.paidAt) }}
                            </p>

                            <span slot="right">{{ formatPrice(payment.price) }}</span>
                            <span slot="right" class="icon arrow-right-small gray" />
                        </STListItem>
                    </STList>
                </template>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ErrorBox, GlobalEventBus, LoadingButton, Spinner, STErrorsDefault, STList, STListItem, STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { BalanceItemDetailed, FinancialSupportSettings, getPermissionLevelNumber, MemberBalanceItem, MemberWithRegistrations, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, Registration } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import PaymentView from '../payments/PaymentView.vue';
import EditBalanceItemView from './balance/EditBalanceItemView.vue';
import EditPaymentView from './EditPaymentView.vue';

@Component({ 
    components: { 
        STToolbar,
        LoadingButton,
        Spinner,
        STErrorsDefault,
        STList,
        STListItem
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        date: Formatter.dateTime.bind(Formatter)
    }
})
export default class MemberViewPayments extends Mixins(NavigationMixin) {
    @Prop()
    member!: MemberWithRegistrations;

    @Prop({default: null})
    defaultRegistration!: Registration | null;

    @Prop()
    familyManager!: FamilyManager;
    
    loadingPayments = true
    errorBox: ErrorBox | null = null

    balanceItems: MemberBalanceItem[] = []

    organization = OrganizationManager.organization

    created() {
        this.reload().catch(e => {
            console.error(e)
        })

        // Listen for patches in payments
        GlobalEventBus.addListener(this, "paymentPatch", async (payment) => {
            if (payment && payment.id && this.paymentIds.includes(payment.id as string)) {
                // Reload members and family
                this.reloadFamily()

                // We need to reload because pricePaid doesn't update from balace items
                this.reload().catch(console.error)
            }
            return Promise.resolve()
        })
    }

    getMember(id: string) {
        return this.familyManager.members.find(m => m.id == id)
    }

    get multipleMembers() {
        return this.familyManager.members.length > 1
    }

    get hasWrite(): boolean {
        if (!OrganizationManager.user.permissions) {
            return false
        }

        if (OrganizationManager.user.permissions.hasFullAccess() || OrganizationManager.user.permissions.canManagePayments(this.organization.privateMeta?.roles ?? []) ) {
            // Can edit members without groups
            return true
        }

        for (const group of this.member.groups) {
            if(group.privateSettings && group.privateSettings.permissions.hasAccess(OrganizationManager.user.permissions, PermissionLevel.Write)) {
                return true
            }
        }
        
        return false
    }

    get filteredBalanceItems(): MemberBalanceItem[] {
        return this.balanceItems.filter(b => b.price - b.pricePaid !== 0)
    }

    get payments() {
        const payments = new Map<string, Payment>()
        for (const item of this.balanceItems) {
            for (const payment of item.payments) {
                payments.set(payment.payment.id, payment.payment)
            }
        }
        return [...payments.values()]
    }


    get paymentIds() {
        const payments = new Set<string>()
        for (const item of this.balanceItems) {
            for (const payment of item.payments) {
                payments.add(payment.payment.id)
            }
        }
        return [...payments.values()]
    }

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

    createBalanceItem() {
        const balanceItem = MemberBalanceItem.create({
            memberId: this.member.id
        })
        const component = new ComponentWithProperties(EditBalanceItemView, {
            balanceItem,
            isNew: true,
            saveHandler: async (patch: AutoEncoderPatchType<MemberBalanceItem>) => {
                const arr: PatchableArrayAutoEncoder<MemberBalanceItem> = new PatchableArray();
                arr.addPut(balanceItem.patch(patch))
                await SessionManager.currentSession!.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/organization/balance',
                    body: arr,
                    decoder: new ArrayDecoder(MemberBalanceItem),
                    shouldRetry: false
                });
                await this.reload();
                // Also reload member outstanding amount of the whole family
                this.reloadFamily();
            }
        })
        this.present({
            components: [component],
            modalDisplayStyle: "popup"
        })
    }

    createPayment() {
        const payment = PaymentGeneral.create({
            method: PaymentMethod.PointOfSale,
            status: PaymentStatus.Succeeded,
            paidAt: new Date()
        })

        const component = new ComponentWithProperties(EditPaymentView, {
            payment,
            balanceItems: this.balanceItems.map(b => BalanceItemDetailed.create({...b, member: b.memberId ? this.getMember(b.memberId) : null})),
            familyManager: this.familyManager,
            isNew: true,
            saveHandler: async (patch: AutoEncoderPatchType<PaymentGeneral>) => {
                const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
                arr.addPut(payment.patch(patch))
                await SessionManager.currentSession!.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/organization/payments',
                    body: arr,
                    decoder: new ArrayDecoder(PaymentGeneral),
                    shouldRetry: false
                });
                await this.reload();
                // Also reload member outstanding amount of the whole family
                this.reloadFamily();
            }
        })
        this.present({
            components: [component],
            modalDisplayStyle: "popup"
        })
    }

    editBalanceItem(balanceItem: MemberBalanceItem) {
        if (!this.hasWrite) {
            return
        }
        const component = new ComponentWithProperties(EditBalanceItemView, {
            balanceItem,
            isNew: false,
            saveHandler: async (patch: AutoEncoderPatchType<MemberBalanceItem>) => {
                const arr: PatchableArrayAutoEncoder<MemberBalanceItem> = new PatchableArray();
                patch.id = balanceItem.id;
                arr.addPatch(patch)
                await SessionManager.currentSession!.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/organization/balance',
                    body: arr,
                    decoder: new ArrayDecoder(MemberBalanceItem),
                    shouldRetry: false
                });
                await this.reload();
                // Also reload member outstanding amount of the whole family
                this.reloadFamily();
            }
        })
        this.present({
            components: [component],
            modalDisplayStyle: "popup"
        })
    }

    openPayment(payment: Payment) {
        const component = new ComponentWithProperties(PaymentView, {
            initialPayment: payment
        })
        this.present({
            components: [component],
            modalDisplayStyle: "popup"
        })
    }

    get outstandingBalance() {
        return MemberBalanceItem.getOutstandingBalance(this.balanceItems)
    }

    beforeDestroy() {
        GlobalEventBus.removeListener(this)
        Request.cancelAll(this)
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

    reloadFamily() {
        // This can happen in the background
        this.familyManager.loadFamily(this.member.id).catch(console.error)
    }

    async reload() {
        try {
            this.loadingPayments = true;
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: 'GET',
                path: `/organization/members/${this.member.id}/balance`,
                decoder: new ArrayDecoder(MemberBalanceItem as Decoder<MemberBalanceItem>),
                owner: this
            });
            response.data.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
            
            // Try to reuse existing references
            const newItems = response.data

            for (const item of this.balanceItems) {
                const found = newItems.findIndex(i => i.id === item.id)
                if (found !== -1) {
                    // Replace with existing reference
                    const newItem = newItems[found];

                    // Same for payments
                    for (const payment of item.payments) {
                        const foundPayment = newItem.payments.findIndex(p => p.payment.id === payment.payment.id)
                        if (foundPayment !== -1) {
                            // Replace with existing reference
                            payment.set(newItem.payments[foundPayment])
                            newItem.payments[foundPayment] = payment
                        }
                    }
                    
                    item.set(newItem)
                    newItems[found] = item
                }
            }
            
            this.balanceItems = newItems;
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loadingPayments = false;
    }

    get financialSupportWarningText() {
        return this.organization.meta.recordsConfiguration.financialSupport?.warningText || FinancialSupportSettings.defaultWarningText
    }

    getMethodName(method: PaymentMethod) {
        return PaymentMethodHelper.getNameCapitalized(method)
    }
}
</script>
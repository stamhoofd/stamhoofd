<template>
    <div class="member-payments-view">
        <main class="container">
            <STErrorsDefault :error-box="errorBox" />
            <Spinner v-if="loadingPayments" />

            <template v-else>
                <p v-if="member.details.requiresFinancialSupport && member.details.requiresFinancialSupport.value" class="warning-box">
                    {{ financialSupportWarningText }}
                </p>

                <p v-if="balanceItems.length == 0" class="info-box">
                    Geen openstaande rekening
                </p>
                
                <STList>
                    <STListItem v-for="item in balanceItems" :key="item.id" :selectable="true" @click="editBalanceItem(item)">
                        <h3 class="style-title-list">
                            {{ item.description }}
                        </h3>
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

                <button type="button" class="button text" @click="createBalanceItem">
                    <span class="icon add" />
                    <span>Bedrag aanrekenen</span>
                </button>

                <button v-if="false" type="button" class="button text">
                    <span class="icon card" />
                    <span>Betaling ontvangen</span>
                </button>

                <button v-if="false" type="button" class="button text">
                    <span class="icon email" />
                    <span>Betaalverzoek versturen</span>
                </button>
               
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
                    <h2>Ontvangen betalingen</h2>

                    <STList>
                        <STListItem v-for="payment of succeededPayments" :key="payment.id" :selectable="true" @click="openPayment(payment)">
                            <h3 class="style-title-list">
                                {{ getPaymentMethodName(payment.method) }}
                            </h3>
                            <p class="style-description-small">
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
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ErrorBox, LoadingButton, Spinner, STErrorsDefault, STList, STListItem, STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { FinancialSupportSettings, getPermissionLevelNumber, MemberBalanceItem, MemberWithRegistrations, Payment, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, Registration } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import PaymentView from '../payments/PaymentView.vue';
import EditBalanceItemView from './balance/EditBalanceItemView.vue';

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

    mounted() {
        this.reload().catch(e => {
            console.error(e)
        })
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
        return [...payments.values()]
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
        return [...payments.values()]
    }

    createBalanceItem() {
        const balanceItem = MemberBalanceItem.create({
            memberId: this.member.id,
            registration: this.defaultRegistration ?? null
        })
        const component = new ComponentWithProperties(EditBalanceItemView, {
            balanceItem,
            isNew: true,
            saveHandler: async (patch: AutoEncoderPatchType<MemberBalanceItem>) => {
                const arr: PatchableArrayAutoEncoder<MemberBalanceItem> = new PatchableArray();
                arr.addPut(balanceItem.patch(patch))
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/organization/balance',
                    body: arr,
                    decoder: new ArrayDecoder(MemberBalanceItem)
                });
                await this.reload();
            }
        })
        this.present({
            components: [component],
            modalDisplayStyle: "popup"
        })
    }

    editBalanceItem(balanceItem: MemberBalanceItem) {
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
                    decoder: new ArrayDecoder(MemberBalanceItem)
                });
                await this.reload();
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

    get hasWrite(): boolean {
        if (!OrganizationManager.user.permissions) {
            return false
        }

        if (OrganizationManager.user.permissions.hasFullAccess()) {
            // Can edit members without groups
            return true
        }

        if (OrganizationManager.user.permissions.canManagePayments(OrganizationManager.organization.privateMeta?.roles ?? [])) {
            // Can edit members without groups
            return true
        }

        for (const group of this.member.groups) {
            if(group.privateSettings && getPermissionLevelNumber(group.privateSettings.permissions.getPermissionLevel(OrganizationManager.user.permissions)) >= getPermissionLevelNumber(PermissionLevel.Write)) {
                return true
            }
        }
        
        return false
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
            response.data.sort((a, b) => Sorter.byDateValue(b.createdAt, a.createdAt));
            this.balanceItems = response.data;
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.member-payments-view {
    .pricing-box {
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        justify-content: flex-end;

        > * {
            flex-basis: 350px;
        }

        .middle {
            font-weight: 600;
        }
    }
}
</style>
<template>
    <div class="st-view payment-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious|| hasNext" v-tooltip="'Ga naar vorige betaling'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende betaling'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goNext" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ title }}</span>

                <span v-if="mappedPayment.isPending" class="style-tag warn">Wacht op betaling</span>
                <span v-if="mappedPayment.isFailed" class="style-tag error">Mislukt</span>
            </h1>

            <p v-if="payment && payment.method == 'Transfer' && payment.isFailed" class="error-box">
                Deze overschrijving werd geannuleerd en is niet langer zichtbaar. Ontvang je toch nog de betaling? Heractiveer de overschrijving dan terug.
            </p>

            <STErrorsDefault :error-box="errorBox" />
            <Spinner v-if="loading" />

            <template v-if="payment">
                <STList class="info">
                    <STListItem>
                        <h3 class="style-definition-label">
                            Totaalbedrag
                        </h3>
                        <p class="style-definition-text">
                            {{ formatPrice(payment.price) }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.method == 'Transfer'">
                        <h3 class="style-definition-label">
                            Mededeling
                        </h3>
                        <p class="style-definition-text">
                            {{ payment.transferDescription }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.method == 'Transfer' && payment.transferSettings">
                        <h3 v-if="payment.price >= 0" class="style-definition-label">
                            Betalen aan
                        </h3>
                        <h3 v-else class="style-definition-label">
                            Terugbetaald vanaf
                        </h3>
                        <p class="style-definition-text">
                            {{ payment.transferSettings }}
                        </p>
                    </STListItem>

                    <STListItem v-if="isManualMethod">
                        <h3 class="style-definition-label">
                            Aangemaakt op
                        </h3>
                        <p class="style-definition-text">
                            {{ formatDate(payment.createdAt) }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.paidAt">
                        <h3 v-if="payment.price >= 0" class="style-definition-label">
                            Betaald op
                        </h3>
                        <h3 v-else class="style-definition-label">
                            Terugbetaald op
                        </h3>
                        <p class="style-definition-text">
                            {{ formatDate(payment.paidAt) }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.iban">
                        <h3 class="style-definition-label">
                            Betaald door IBAN
                        </h3>

                        <p class="style-definition-text">
                            {{ payment.iban }}
                            <template v-if="payment.ibanName">
                                <br>({{ payment.ibanName }})
                            </template>
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.settlement" class="right-description right-stack">
                        <h3 class="style-definition-label">
                            Uitbetaald op
                        </h3>

                        <p class="style-definition-text">
                            {{ formatDate(payment.settlement.settledAt) }}<br>
                            Mededeling "{{ payment.settlement.reference }}"
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.transferFee">
                        <h3 class="style-definition-label">
                            Transactiekost
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(payment.transferFee) }}
                        </p>
                        <p class="style-description-small">
                            <template v-if="VATPercentage > 0">
                                Incl. {{ VATPercentage }}% BTW —
                            </template> <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/transactiekosten-inhouding/'" class="inline-link" target="_blank">Meer info</a>
                        </p>
                    </STListItem>
                </STList>

                <template v-if="isManualMethod && canWrite">
                    <hr>
                    <h2>Acties</h2>

                    <STList>
                        <STListItem v-if="mappedPayment.isFailed" :selectable="true" @click="markPending">
                            <h2 class="style-title-list">
                                Heactiveer
                            </h2>
                            <p class="style-description">
                                Wijzig de status terug naar 'wacht op betaling'.
                            </p>
                            <template #right><button type="button" class="button secundary hide-smartphone">
                                <span class="icon clock" />
                                <span>Heractiveer</span>
                            </button>
                            <button type="button" class="button icon success only-smartphone" /></template>
                        </STListItem>

                        <STListItem v-if="mappedPayment.isPending" :selectable="true" @click="markPaid">
                            <h2 v-if="payment.price >= 0" class="style-title-list">
                                Markeer als betaald
                            </h2>
                            <h2 v-else class="style-title-list">
                                Markeer als terugbetaald
                            </h2>
                            <p v-if="mappedPayment.orders.length" class="style-description">
                                Stuurt mogelijks een automatische e-mail ter bevestiging.
                            </p>
                            <template #right><button type="button" class="button secundary hide-smartphone">
                                <span class="icon success" />
                                <span v-if="payment.price >= 0">Betaald</span>
                                <span v-else>Terugbetaald</span>
                            </button>
                            <button type="button" class="button icon success only-smartphone" /></template>
                        </STListItem>

                        <STListItem v-if="mappedPayment.isSucceeded" :selectable="true" @click="markPending">
                            <h2 v-if="payment.price >= 0" class="style-title-list">
                                Toch niet betaald
                            </h2>
                            <h2 v-else class="style-title-list">
                                Toch niet terugbetaald
                            </h2>
                            <p v-if="payment.method == 'Transfer'" class="style-description">
                                Overschrijving per ongeluk gemarkeerd als betaald? Maak dat hiermee ongedaan.
                            </p>
                            <p v-else class="style-description">
                                Betaling per ongeluk gemarkeerd als betaald? Maak dat hiermee ongedaan.
                            </p>
                            <template #right><button type="button" class="button secundary hide-smartphone">
                                <span class="icon undo" />
                                <span v-if="payment.price >= 0">Niet betaald</span>
                                <span v-else>Niet terugbetaald</span>
                            </button><button type="button" class="button icon undo only-smartphone" /></template>
                        </STListItem>

                        <STListItem v-if="mappedPayment.isPending" :selectable="true" @click="markFailed">
                            <h2 class="style-title-list">
                                Annuleren
                            </h2>
                            <p v-if="payment.method == 'Transfer'" class="style-description">
                                Annuleer de overschrijving als je denkt dat deze niet meer betaald zal worden.
                            </p>
                            <p v-else class="style-description">
                                Annuleer de betaling als je denkt dat deze niet meer betaald zal worden.
                            </p>
                            <template #right><button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon canceled" />
                                <span>Annuleren</span>
                            </button><button type="button" class="button icon canceled only-smartphone" /></template>
                        </STListItem>
                    </STList>
                </template>

                <template v-if="payment.balanceItemPayments.length">
                    <hr>
                    <h2>Overzicht</h2>
                    <STList>
                        <STListItem v-for="item in payment.balanceItemPayments" :key="item.id" :selectable="true" @click="editBalanceItem(item.balanceItem)">
                            <h3 class="style-title-list">
                                {{ item.balanceItem.description }}
                            </h3>
                            <p v-if="item.balanceItem.member" class="style-description-small">
                                {{ item.balanceItem.member.name }}
                            </p>

                            <p class="style-description-small">
                                {{ formatDate(item.balanceItem.createdAt) }}
                            </p>
                            <p v-if="item.price < 0" class="style-description-small">
                                Terugbetaling van {{ formatPrice(-item.price) }}
                            </p>
                            <p v-else-if="item.price !== item.balanceItem.price" class="style-description-small">
                                Slechts deel van het totaalbedrag, {{ formatPrice(item.price) }} / {{ formatPrice(item.balanceItem.price) }}
                            </p>
                            <p v-if="item.balanceItem.status === 'Hidden'" class="style-tag error">
                                Verwijderd
                            </p>
                            <template #right>
                                {{ formatPrice(item.price) }}
                            </template>
                        </STListItem>
                    </STList>

                    <div class="pricing-box">
                        <STList>
                            <STListItem>
                                Totaal

                                <template #right>
                                    {{ formatPrice(payment.price) }}
                                </template>
                            </STListItem>
                        </STList>
                    </div>
                </template>

                <hr>
                <h2>Contactgegevens</h2>
                
                <p v-if="contactInfo.length == 0" class="info-box">
                    Er zijn geen contactgegevens beschikbaar.
                </p>
                <STList v-else class="info">
                    <STListItem v-for="(info, index) of contactInfo" :key="index">
                        <h3 class="style-definition-label">
                            {{ info.title }}
                        </h3>
                        <p v-for="(value, index2) of info.values" :key="index2" v-copyable class="style-definition-text style-copyable" v-text="value" />
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { ErrorBox, GlobalEventBus, STErrorsDefault, STList, STListItem, STNavigationBar, Spinner, Toast } from "@stamhoofd/components";
import { BalanceItemDetailed, MemberBalanceItem, ParentTypeHelper, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, calculateVATPercentage } from "@stamhoofd/structures";

import EditBalanceItemView from "./EditBalanceItemView.vue";

@Component({
    components: {
        STNavigationBar,
        STList,
        STListItem,
        STErrorsDefault,
        Spinner
    }
})
export default class PaymentView extends Mixins(NavigationMixin) {
    @Prop()
        initialPayment!: Payment;

    payment: PaymentGeneral | null = null
    errorBox: ErrorBox | null = null

    loading = false

    get VATPercentage() {
        return calculateVATPercentage(this.organization.meta.companyAddress ?? this.organization.address, this.organization.meta.VATNumber)
    }

    get organization() {
        return this.$context.organization!
    }

    get title() {
        return PaymentMethodHelper.getNameCapitalized(this.initialPayment.method ?? PaymentMethod.Unknown)
    }

    get isManualMethod() {
        return this.initialPayment.method === PaymentMethod.Transfer || this.initialPayment.method === PaymentMethod.PointOfSale || this.initialPayment.method === PaymentMethod.Unknown
    }

    get mappedPayment() {
        return this.payment ?? this.initialPayment;
    }

    get canWrite() {
        return this.$context.organizationAuth.canAccessPayment(this.payment, PermissionLevel.Write)
    }

    @Prop({ default: null })
        getNext!: (PaymentGeneral) => PaymentGeneral | null;

    @Prop({ default: null })
        getPrevious!: (PaymentGeneral) => PaymentGeneral | null;

    get hasNext(): boolean {
        if (!this.getNext) {
            return false
        }
        return !!this.getNext(this.initialPayment);
    }

    get hasPrevious(): boolean {
        if (!this.getPrevious) {
            return false
        }
        return !!this.getPrevious(this.initialPayment);
    }

    goBack() {
        const payment = this.getPrevious(this.initialPayment);
        if (!payment) {
            return;
        }
        const component = new ComponentWithProperties(PaymentView, {
            initialPayment: payment,
            getNext: this.getNext,
            getPrevious: this.getPrevious
        });

        this.show({
            components: [component],
            replace: 1,
            reverse: true,
            animated: false
        })
    }

    goNext() {
        const payment = this.getNext(this.initialPayment);
        if (!payment) {
            return;
        }
        const component = new ComponentWithProperties(PaymentView, {
            initialPayment: payment,
            getNext: this.getNext,
            getPrevious: this.getPrevious
        });

        this.show({
            components: [component],
            replace: 1,
            animated: false
        })
    }

    activated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        if (!this.isFocused) {
            return
        }

        const key = event.key || event.keyCode;

        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
            this.goBack();
            event.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
            this.goNext();
            event.preventDefault();
        }
    }

    mounted() {
        // Load the full payment if we don't have this
        if (this.initialPayment instanceof PaymentGeneral) {
            this.payment = this.initialPayment;
        } else {
            this.reload().catch(console.error);
        }
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    async reload() {
        try {
            this.loading = true;
            const response = await this.$context.authenticatedServer.request({
                method: 'GET',
                path: `/payments/${this.initialPayment.id}`,
                decoder: PaymentGeneral as Decoder<PaymentGeneral>,
                owner: this
            });
            this.payment = response.data;
            this.initialPayment.set(this.payment);
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false;
    }

    get contactInfo() {
        const added = new Set<string>()
        const contactInfo: {title: string, values:string[]}[] = [];

        if (!this.payment) {
            return contactInfo;
        }

        for (const member of this.payment.members) {

            const key = 'member-' + member.id;
            if (!added.has(key)) {
                const values: string[] = [];
                //if (member.details.phone) {
                //    values.push(member.details.phone);
                //}
//
                //if (member.details.email) {
                //    values.push(member.details.email);
                //}

                if (values.length) {
                    contactInfo.push({
                        title: member.name + ' (lid)',
                        values
                    })
                }
                added.add(key);

                //for (const parent of member.details.parents) {
                //    const key = 'parent-' + parent.name;
                //    if (!added.has(key)) {
                //        const values: string[] = [];
                //        if (parent.phone) {
                //            values.push(parent.phone);
                //        }
//
                //        if (parent.email) {
                //            values.push(parent.email);
                //        }
//
                //        if (values.length) {
                //            contactInfo.push({
                //                title: parent.name + ' (' + ParentTypeHelper.getName(parent.type) + ')',
                //                values
                //            })
                //        }
//
                //        added.add(key);
                //    }
                //}
            }
        }

        for (const order of this.payment.orders) {
            const key = 'order-'+order.id;

            if (!added.has(key)) {
                const values: string[] = [];
                if (order.data.customer.phone) {
                    values.push(order.data.customer.phone);
                }

                if (order.data.customer.email) {
                    values.push(order.data.customer.email);
                }

                if (values.length) {
                    contactInfo.push({
                        title: order.data.customer.name,
                        values
                    })
                }
                added.add(key);
            }
        }
        return contactInfo;
    }

    markingPaid = false;

    async markPaid() {
        await this.mark(PaymentStatus.Succeeded)
    }

    async markPending() {
        await this.mark(PaymentStatus.Pending)
    }

    async markFailed() {
        await this.mark(PaymentStatus.Failed)
    }

    async mark(status: PaymentStatus) {
        if (this.markingPaid) {
            return;
        }

        this.markingPaid = true;

        try {
            const data: PatchableArrayAutoEncoder<Payment> = new PatchableArray()
            data.addPatch(Payment.patch({
                id: this.mappedPayment.id,
                status
            }));

            // Create a patch for this payment
            const response = await this.$context.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/payments",
                body: data,
                decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
                shouldRetry: false
            })
            this.payment = response.data[0];
            this.initialPayment.set(this.payment);

            GlobalEventBus.sendEvent('paymentPatch', this.payment).catch(console.error);
            new Toast("Betaalstatus gewijzigd", "success").setHide(1000).show()
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.markingPaid = false;
    }

    editBalanceItem(balanceItem: BalanceItemDetailed) {
        if (!this.canWrite) {
            return
        }
        const component = new ComponentWithProperties(EditBalanceItemView, {
            balanceItem,
            isNew: false,
            saveHandler: async (patch: AutoEncoderPatchType<BalanceItemDetailed>) => {
                const arr: PatchableArrayAutoEncoder<BalanceItemDetailed> = new PatchableArray();
                patch.id = balanceItem.id;
                arr.addPatch(patch)
                await this.$context.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/organization/balance',
                    body: arr,
                    decoder: new ArrayDecoder(MemberBalanceItem),
                    shouldRetry: false
                });
                await this.reload();
            }
        })
        this.present({
            components: [component],
            modalDisplayStyle: "popup"
        })
    }
}
</script>

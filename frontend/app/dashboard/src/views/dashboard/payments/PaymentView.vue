<template>
    <div class="st-view payment-view">
        <STNavigationBar :title="title" :pop="canPop" :dismiss="canDismiss">
            <template #right>
                <!-- TODO buttons -->
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ title }}</span>

                <span v-if="mappedPayment.isPending" class="style-tag warn">Wacht op betaling</span>
            </h1>

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

                    <STListItem v-if="payment.method == 'Transfer'">
                        <h3 class="style-definition-label">
                            Betalen aan
                        </h3>
                        <p class="style-definition-text">
                            {{ payment.transferSettings }}
                        </p>
                    </STListItem>

                    <STListItem>
                        <h3 class="style-definition-label">
                            Aangemaakt op
                        </h3>
                        <p class="style-definition-text">
                            {{ formatDate(payment.createdAt) }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.paidAt">
                        <h3 class="style-definition-label">
                            Betaald op
                        </h3>
                        <p class="style-definition-text">
                            {{ formatDate(payment.paidAt) }}
                        </p>
                    </STListItem>
                </STList>

                <template v-if="payment.method == 'Transfer'">
                    <hr>
                    <h2>Acties</h2>

                    <STList>
                        <STListItem v-if="mappedPayment.isPending" :selectable="true" @click="markPaid">
                            <h2 class="style-title-list">
                                Markeer als betaald
                            </h2>
                            <p class="style-description">
                                Stuurt een automatische e-mail ter bevestiging
                            </p>
                            <button slot="right" type="button" class="button secundary hide-smartphone">
                                <span class="icon success" />
                                <span>Betaald</span>
                            </button>
                            <button slot="right" type="button" class="button icon success only-smartphone" />
                        </STListItem>

                        <STListItem v-if="mappedPayment.isSucceeded" :selectable="true" @click="markPending">
                            <h2 class="style-title-list">
                                Toch niet betaald
                            </h2>
                            <p class="style-description">
                                Overschrijving per ongeluk gemarkeerd als betaald? Maak dat hiermee ongedaan.
                            </p>
                            <button slot="right" type="button" class="button secundary hide-smartphone">
                                <span class="icon undo" />
                                <span>Niet betaald</span>
                            </button>
                            <button slot="right" type="button" class="button icon undo only-smartphone" />
                        </STListItem>

                        <STListItem v-if="mappedPayment.isPending" :selectable="true" @click="markFailed">
                            <h2 class="style-title-list">
                                Annuleren
                            </h2>
                            <p class="style-description">
                                Annuleer de overschrijving zodat voor een andere betaalmethode gekozen kan worden.
                            </p>
                            <button slot="right" type="button" class="button secundary danger hide-smartphone">
                                <span class="icon canceled" />
                                <span>Annuleren</span>
                            </button>
                            <button slot="right" type="button" class="button icon canceled only-smartphone" />
                        </STListItem>
                    </STList>
                </template>

                <hr>
                <h2>Overzicht</h2>
                <STList>
                    <STListItem v-for="item in payment.balanceItemPayments" :key="item.id" :selectable="false">
                        <h3 class="style-title-list">
                            {{ item.balanceItem.description }}
                        </h3>
                        <p class="style-description-small">
                            {{ formatDate(item.balanceItem.createdAt) }}
                        </p>
                        <p v-if="item.price !== item.balanceItem.price" class="style-description-small">
                            Gedeeltelijke betaling van totaalbedrag van {{ formatPrice(item.balanceItem.price) }}
                        </p>
                        <template slot="right">
                            {{ formatPrice(item.price) }}
                        </template>
                    </STListItem>
                </STList>

                <div class="pricing-box">
                    <STList>
                        <STListItem>
                            Totaal

                            <template slot="right">
                                {{ formatPrice(payment.price) }}
                            </template>
                        </STListItem>
                    </STList>
                </div>

                <hr>
                <h2>Contactgegevens</h2>
                
                <STList class="info">
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CopyableDirective, ErrorBox, Spinner,STErrorsDefault,STList, STListItem, STNavigationBar, Toast } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { ParentTypeHelper, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
        STNavigationBar,
        STList,
        STListItem,
        STErrorsDefault,
        Spinner
    },
    directives: {
        Copyable: CopyableDirective
    }
})
export default class PaymentView extends Mixins(NavigationMixin) {
    @Prop()
    initialPayment!: Payment;

    payment: PaymentGeneral | null = null
    errorBox: ErrorBox | null = null

    loading = false

    get title() {
        return PaymentMethodHelper.getNameCapitalized(this.initialPayment.method ?? PaymentMethod.Unknown)
    }

    get mappedPayment() {
        return this.payment ?? this.initialPayment;
    }

    mounted() {
        // Load the full payment if we don't have this
        if (this.initialPayment instanceof PaymentGeneral) {
            this.payment = this.initialPayment;
        } else {
            this.reload().catch(console.error);
        }
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

    async reload() {
        try {
            this.loading = true;
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: 'GET',
                path: `/organization/payments/${this.initialPayment.id}`,
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

        for (const registration of this.payment.registrations) {
            const member = registration.member;

            const key = 'member-' + member.id;
            if (!added.has(key)) {
                const values: string[] = [];
                if (member.details.phone) {
                    values.push(member.details.phone);
                }

                if (member.details.email) {
                    values.push(member.details.email);
                }

                if (values.length) {
                    contactInfo.push({
                        title: member.name + ' (lid)',
                        values
                    })
                }
                added.add(key);

                for (const parent of member.details.parents) {
                    const key = 'parent-' + parent.name;
                    if (!added.has(key)) {
                        const values: string[] = [];
                        if (parent.phone) {
                            values.push(parent.phone);
                        }

                        if (parent.email) {
                            values.push(parent.email);
                        }

                        if (values.length) {
                            contactInfo.push({
                                title: parent.name + ' (' + ParentTypeHelper.getName(parent.type) + ')',
                                values
                            })
                        }

                        added.add(key);
                    }
                }
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
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/payments",
                body: data,
                decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
                shouldRetry: false
            })
            this.payment = response.data[0];
            this.initialPayment.set(this.payment);

            new Toast("Betaalstatus gewijzigd", "success").setHide(1000).show()
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.markingPaid = false;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.payment-view {
    .pricing-box {
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        justify-content: flex-end;

        > * {
            flex-basis: 250px;
        }

        .middle {
            font-weight: 600;
        }
    }
}
</style>
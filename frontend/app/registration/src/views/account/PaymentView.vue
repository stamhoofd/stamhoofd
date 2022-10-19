<template>
    <div class="st-view payment-view">
        <STNavigationBar :title="title" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ title }}</span>

                <span v-if="mappedPayment.isPending" class="style-tag warn">In verwerking</span>
                <span v-if="mappedPayment.isFailed" class="style-tag error">Mislukt</span>
            </h1>

            <p v-if="mappedPayment.method == 'Transfer' && mappedPayment.isFailed" class="error-box">
                Deze overschrijving werd geannuleerd.
            </p>

            <p v-if="mappedPayment.method == 'Transfer' && mappedPayment.isPending" class="warning-box">
                We hebben deze overschrijving nog niet gemarkeerd als betaald. Breng de betaling indien nodig in orde (als dat nog niet gebeurd is).
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

                    <STListItem v-if="payment.method == 'Transfer'">
                        <h3 class="style-definition-label">
                            Betalen aan
                        </h3>
                        <p class="style-definition-text">
                            {{ payment.transferSettings }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.method == 'Transfer'">
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

                <template v-if="payment.balanceItemPayments.length">
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
                                Slechts deel van het totaalbedrag, {{ formatPrice(item.price) }} / {{ formatPrice(item.balanceItem.price) }}
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
                </template>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CopyableDirective, ErrorBox, Spinner, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STList,
        STListItem,
        STErrorsDefault,
        Spinner,
        STToolbar
    },
    directives: {
        Copyable: CopyableDirective,
        Tooltip: TooltipDirective
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
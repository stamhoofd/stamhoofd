<template>
    <div class="st-view order-view">
        <STNavigationBar :title="'Bestelling ' + order.number">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
                <button v-if="hasPreviousOrder" class="button text" @click="goBack">
                    <span class="icon arrow-left" />
                    <span>Vorige</span>
                </button>
            </template>
            <template #right>
                <button v-if="hasNextOrder" class="button text" @click="goNext">
                    <span>Volgende</span>
                    <span class="icon arrow-right" />
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>
        <main>
            <h1>
                Bestelling {{ order.number }}
            </h1>

            <p v-if="order.payment && order.payment.status != 'Succeeded'" class="warning-box">
                Opgelet: deze bestelling werd nog niet betaald.
            </p>

            <STList>
                <STListItem class="right-description">
                    Naam

                    <template slot="right">
                        <p>{{ order.data.customer.name }}</p>
                        <p>{{ order.data.customer.phone }}</p>
                        <p>{{ order.data.customer.email }}</p>
                    </template>
                </STListItem>
                <STListItem v-for="a in order.data.fieldAnswers" :key="a.field.id" class="right-description">
                    {{ a.field.name }}

                    <template slot="right">
                        {{ a.answer || "/" }}
                    </template>
                </STListItem>
                <STListItem v-if="order.payment" class="right-description right-stack">
                    Betaalmethode

                    <template slot="right">
                        {{ getName(order.payment.method) }}

                        <span v-if="order.payment.status == 'Succeeded'" class="icon green success" />
                        <span v-else class="icon clock" />
                    </template>
                </STListItem>
                <STListItem v-if="order.payment && order.payment.method == 'Transfer'" class="right-description right-stack">
                    Mededeling

                    <template slot="right">
                        {{ order.payment.transferDescription }}
                    </template>
                </STListItem>
                <STListItem v-if="order.validAt" class="right-description">
                    Geplaatst op
                    <template slot="right">
                        {{ order.validAt | dateTime | capitalizeFirstLetter }}
                    </template>
                </STListItem>
                <STListItem class="right-description">
                    Bestelnummer

                    <template slot="right">
                        {{ order.number }}
                    </template>
                </STListItem>
                <template v-if="order.data.checkoutMethod">
                    <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                        <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                            Afhaallocatie
                        </template>
                        <template v-else>
                            Leveringsmethode
                        </template>

                        <template slot="right">
                            {{ order.data.checkoutMethod.name }}
                        </template>
                    </STListItem>
                    <STListItem v-if="order.data.checkoutMethod.address" class="right-description">
                        Adres

                        <template slot="right">
                            {{ order.data.checkoutMethod.address }}
                        </template>
                    </STListItem>
                    <STListItem v-if="order.data.address" class="right-description">
                        Leveringsadres

                        <template slot="right">
                            {{ order.data.address }}
                        </template>
                    </STListItem>
                    <STListItem v-if="order.data.timeSlot" class="right-description">
                        <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                            Wanneer afhalen?
                        </template>
                        <template v-else>
                            Wanneer leveren?
                        </template>

                        <template slot="right">
                            {{ order.data.timeSlot.date | date | capitalizeFirstLetter }}<br>{{ order.data.timeSlot.startTime | minutes }} - {{ order.data.timeSlot.endTime | minutes }}
                        </template>
                    </STListItem>
                </template>
                <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                    Leveringskost

                    <template slot="right">
                        {{ order.data.deliveryPrice | price }}
                    </template>
                </STListItem>
                <STListItem class="right-description">
                    Totaal

                    <template slot="right">
                        {{ order.data.totalPrice | price }}
                    </template>
                </STListItem>
            </STList>

            <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                <hr>
                <h2 v-if="order.data.checkoutMethod.type == 'Takeout'">
                    Afhaalopmerkingen
                </h2>
                <h2 v-else>
                    Leveringsopmerkingen
                </h2>

                <p class="pre-wrap" v-text="order.data.checkoutMethod.description" />
            </div>

            <hr>

            <STList>
                <STListItem v-for="cartItem in order.data.cart.items" :key="cartItem.id" class="cart-item-row">
                    <h3>
                        {{ cartItem.product.name }}
                    </h3>
                    <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                    <footer>
                        <p class="price">
                            {{ cartItem.amount }} x {{ cartItem.getUnitPrice(order.data.cart) | price }}
                        </p>
                    </footer>

                    <figure v-if="imageSrc(cartItem)" slot="right">
                        <img :src="imageSrc(cartItem)">
                    </figure>
                </STListItem>
            </STList>
        </main>

        <STToolbar v-if="hasWrite && order.payment && order.payment.method == 'Transfer'">
            <LoadingButton slot="right" :loading="loadingPayment">
                <button v-if="order.payment.status == 'Succeeded' && order.payment.paidAt" class="button secundary" @click="markNotPaid(order.payment)">
                    Toch niet betaald
                </button>
                <button v-else class="button primary" @click="markPaid(order.payment)">
                    Markeer als betaald
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, LoadingButton, LoadingView, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { CartItem, EncryptedPaymentDetailed, getPermissionLevelNumber, Order, Payment, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateWebshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import { WebshopManager } from "../WebshopManager";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        LoadingView
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        date: Formatter.dateWithDay.bind(Formatter),
        dateTime: Formatter.dateTimeWithDay.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter),
        capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter)
    }
})
export default class OrderView extends Mixins(NavigationMixin){
    loading = false
    loadingPayment = false
    errorBox: ErrorBox | null = null

    @Prop({ default: null })
    orderId: string | null

    @Prop({ default: null })
    initialOrder!: Order | null

    @Prop({ required: true })
    webshopManager!: WebshopManager

    get webshop() {
        return this.webshopManager.preview
    }

    @Prop({ default: false })
    success: boolean

    order: Order | null = this.initialOrder

    @Prop({ default: null })
    getNextOrder!: (order: Order) => Order | null;

    @Prop({ default: null })
    getPreviousOrder!: (order: Order) => Order | null;

    get hasNextOrder(): boolean {
        if (!this.getNextOrder || !this.order) {
            return false
        }
        return !!this.getNextOrder(this.order);
    }

    get hasPreviousOrder(): boolean {
        if (!this.getPreviousOrder || !this.order) {
            return false
        }
        return !!this.getPreviousOrder(this.order);
    }

    get hasWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        if (p.canManagePayments(OrganizationManager.organization.privateMeta?.roles ?? []) || p.hasFullAccess()) {
            return true
        }
        return getPermissionLevelNumber(this.webshop.privateMeta.permissions.getPermissionLevel(p)) >= getPermissionLevelNumber(PermissionLevel.Write)
    }


    goBack() {
        const order = this.getPreviousOrder(this.order!);
        if (!order) {
            return;
        }
        const component = new ComponentWithProperties(OrderView, {
            initialOrder: order,
            webshopManager: this.webshopManager,
            getNextOrder: this.getNextOrder,
            getPreviousOrder: this.getPreviousOrder,
        });
        this.navigationController?.push(component, true, 1, true);
    }

    goNext() {
        const order = this.getNextOrder(this.order!);
        if (!order) {
            return;
        }
        const component = new ComponentWithProperties(OrderView, {
            initialOrder: order,
            webshopManager: this.webshopManager,
            getNextOrder: this.getNextOrder,
            getPreviousOrder: this.getPreviousOrder,
        });
        this.navigationController?.push(component, true, 1, false);
    }

    getName(paymentMethod: PaymentMethod): string {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod))
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

        const key = event.key || event.keyCode;

        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
            this.goBack();
            event.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
            this.goNext();
            event.preventDefault();
        }
    }

    openTransferView() {
        // todo
    }

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100)
    }

    async markPaid(payment: Payment) {
        if (this.loadingPayment) {
            return;
        }

        const data: AutoEncoderPatchType<Payment>[] = []
        if (payment.status != PaymentStatus.Succeeded) {
            data.push(Payment.patch({
                id: payment.id,
                status: PaymentStatus.Succeeded
            }))
        }

        if (data.length > 0) {
            if (!await CenteredMessage.confirm("Ben je zeker?", "Markeer als betaald", "Tip: je kan dit ook via het menu 'Overschrijvingen' doen voor meerdere overschrijvingen in één keer, dat spaart je wat werk uit.")) {
                return;
            }
            this.loadingPayment = true
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
                })
                const p = response.data.find(pp => pp.id === payment.id)
                if (p) {
                    payment.set(p)
                }
            } catch (e) {
                Toast.fromError(e).show()
            }
            this.loadingPayment = false
            
        }
    }

    async markNotPaid(payment: Payment) {
        if (this.loadingPayment) {
            return;
        }

        const data: AutoEncoderPatchType<Payment>[] = []
        if (payment.status == PaymentStatus.Succeeded) {
            data.push(Payment.patch({
                id: payment.id,
                status: PaymentStatus.Created
            }))
        }

        if (data.length > 0) {
            if (!await CenteredMessage.confirm("Ben je zeker dat deze betaling niet uitgevoerd is?", "Niet betaald")) {
                return;
            }
            this.loadingPayment = true
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
                })
                const p = response.data.find(pp => pp.id === payment.id)
                if (p) {
                    payment.set(p)
                }
            } catch (e) {
                Toast.fromError(e).show()
            }
            this.loadingPayment = false
            
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.order-view {
    .cart-item-row {
        h3 {
            padding-top: 5px;
            @extend .style-title-3;
        }

        .description {
            @extend .style-description-small;
            padding-top: 5px;
            white-space: pre-wrap;
        }

        .price {
            font-size: 14px;
            line-height: 1.4;
            font-weight: 600;
            padding-top: 10px;
            color: $color-primary;
        }

        footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        img {
            width: 100px;
            height: 100px;
            border-radius: $border-radius;
        }
    }

    .pre-wrap {
        @extend .style-description;
        white-space: pre-wrap;
    }
}
</style>
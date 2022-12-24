<template>
    <div class="st-view valid-ticket-view">
        <STNavigationBar title="Geldig ticket" :pop="canPop" />

        <main v-if="!ticket.itemId">
            <h1>
                <span class="icon green success" />
                <span>Bestelling #{{ order.number }}</span>
            </h1>

            <p v-if="order.payment && order.payment.status != 'Succeeded'" class="warning-box">
                Opgelet: deze bestelling werd nog niet betaald.
            </p>

            <p v-if="order.status == 'Completed'" class="warning-box">
                Deze bestelling werd al als voltooid gemarkeerd
            </p>
            <p v-if="order.status == 'Canceled'" class="error-box">
                Deze bestelling werd geannuleerd
            </p>

            <div v-if="hasWarnings" class="hover-box container">
                <hr>
                <ul class="member-records">
                    <li
                        v-for="warning in sortedWarnings"
                        :key="warning.id"
                        :class="{ [warning.type]: true }"
                    >
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr>
            </div>

            <STList>
                <STListItem v-for="cartItem in order.data.cart.items" :key="cartItem.id" class="cart-item-row">
                    <h3>
                        {{ cartItem.product.name }}
                    </h3>
                    <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                    <footer>
                        <p class="price">
                            {{ cartItem.amount }} x
                        </p>
                    </footer>
                </STListItem>
            </STList>

            <hr>
            <h2>Informatie</h2>

            <STList>
                <STListItem>
                    <h3 class="style-definition-label">
                        Totaalbedrag
                    </h3>
                    <p class="style-definition-text">
                        <!-- eslint-disable-next-line vue/singleline-html-element-content-newline -->
                        {{ order.data.totalPrice | price }}<template v-if="order.payment && (order.payment.price != order.data.totalPrice || !order.payment && order.data.totalPrice > 0)">*</template>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Geplaatst op
                    </h3>
                    <p class="style-definition-text">
                        {{ order.validAt | dateTime | capitalizeFirstLetter }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
                    <h3 :class="'style-definition-label '+statusColor">
                        Status
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ statusName }}</span>
                        <span v-if="isCanceled" class="icon canceled" />
                    </p>
                    <span v-if="hasWrite" slot="right" class="icon arrow-down-small gray" />
                </STListItem>

                <STListItem
                    v-if="order.payment" v-long-press="(e) => (hasPaymentsWrite && (order.payment.method == 'Transfer' || order.payment.method == 'PointOfSale') ? changePaymentStatus(e) : null)" :selectable="hasPaymentsWrite" 
                    @click="openPayment" @contextmenu.prevent="hasPaymentsWrite && (order.payment.method == 'Transfer' || order.payment.method == 'PointOfSale') ? changePaymentStatus($event) : null"
                >
                    <h3 class="style-definition-label">
                        Betaling
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ getName(order.payment.method) }}</span>
                        <span v-if="order.payment.status == 'Succeeded'" class="icon primary success" />
                        <span v-else class="icon clock" />
                    </p>

                    <span v-if="hasPaymentsWrite" slot="right" class="icon arrow-right-small gray" />
                </STListItem>
            </STList>

            <template v-if="order.data.checkoutMethod">
                <hr>
                <h2 v-if="order.data.checkoutMethod.type == 'Takeout'">
                    Afhalen
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type == 'Delivery'">
                    Levering
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                    Ter plaatse consumeren
                </h2>
                <h2 v-else>
                    Onbekende methode
                </h2>

                <STList class="info">
                    <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                                Afhaallocatie
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                                Locatie
                            </template>
                            <template v-else>
                                Leveringsmethode
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.checkoutMethod.name }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.checkoutMethod.address" class="right-description">
                        <h3 class="style-definition-label">
                            Adres
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.checkoutMethod.address }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.address" class="right-description">
                        <h3 class="style-definition-label">
                            Leveringsadres
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.address }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.timeSlot" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                                Wanneer afhalen?
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                                Wanneer?
                            </template>
                            <template v-else>
                                Wanneer leveren?
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.timeSlot.date | date | capitalizeFirstLetter }}<br>{{ order.data.timeSlot.startTime | minutes }} - {{ order.data.timeSlot.endTime | minutes }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                        <h3 class="style-definition-label">
                            Leveringskost
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.deliveryPrice | price }}
                        </p>
                    </STListItem>
                </STList>
            </template>

            <hr>
            <h2>Gegevens</h2>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Naam
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        E-mailadres
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.email }}
                    </p>
                </STListItem>

                <STListItem v-if="order.data.customer.phone">
                    <h3 class="style-definition-label">
                        {{ $t("shared.inputs.mobile.label") }}
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.phone }}
                    </p>
                </STListItem>

                <STListItem v-for="a in order.data.fieldAnswers" :key="a.field.id">
                    <h3 class="style-definition-label">
                        {{ a.field.name }}
                    </h3>

                    <p class="style-definition-text">
                        {{ a.answer || "/" }}
                    </p>
                </STListItem>
            </STList>

            <div v-if="order.data.comments" class="container">
                <hr>
                <h2>
                    Notities
                </h2>

                <p class="pre-wrap" v-text="order.data.comments" />
            </div>

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
        </main>

        <main v-else-if="item">
            <h1>
                <span class="icon green success" />
                <span>{{ item.product.name }}</span>
            </h1>
            <p class="ticket-secret">
                {{ ticket.secret }}
            </p>

            <p v-if="order.payment && order.payment.status != 'Succeeded'" class="warning-box">
                Opgelet: deze bestelling werd nog niet betaald.
            </p>

            <STList class="info">
                <STListItem :selectable="true" @click="openOrder">
                    <h3 class="style-definition-label">
                        Bestelling
                    </h3>
                    <p class="style-definition-text">
                        {{ order.number }}
                    </p>

                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem v-if="item.product.prices.length > 1">
                    <p class="style-definition-text">
                        {{ item.productPrice.name }}
                    </p>
                </STListItem>

                <STListItem v-for="answer of item.fieldAnswers" :key="answer.field.id">
                    <h3 class="style-definition-label">
                        {{ answer.field.name }}
                    </h3>
                    <p class="style-definition-text">
                        {{ answer.answer }}
                    </p>
                </STListItem>

                <STListItem v-for="option of item.options" :key="option.optionMenu.id">
                    <h3 class="style-definition-label">
                        {{ option.optionMenu.name }}
                    </h3>
                    <p class="style-definition-text">
                        {{ option.option.name }}
                    </p>
                </STListItem>
            </STList>
        </main>

        <main v-else>
            <h1>
                Leeg ticket?
            </h1>
            <p>Er ging iets mis bij het lezen van de inhoud van dit ticket.</p>
        </main>

        <STToolbar>
            <button v-if="ticket.scannedAt" slot="right" class="button secundary" type="button" @click="cancelScan">
                Markering ongedaan maken
            </button>
            <button slot="right" class="button primary" type="button" @click="markScanned">
                <span class="icon qr-code" />
                <span>Markeer als gescand</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ColorHelper,LongPressDirective,Spinner,STList, STListItem, STNavigationBar, STToolbar, TableActionsContextMenu } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { OrderStatus } from "@stamhoofd/structures";
import { getPermissionLevelNumber, Order, OrderStatusHelper, PaymentMethod, PaymentMethodHelper, PermissionLevel, PrivateOrder, PrivateOrderWithTickets, RecordWarning, TicketPrivate } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager";
import PaymentView from "../../../payments/PaymentView.vue";
import { OrderActionBuilder } from "../../orders/OrderActionBuilder";
import OrderView from "../../orders/OrderView.vue";
import { WebshopManager } from "../../WebshopManager";

@Component({
    components: {
        STNavigationBar,
        BackButton,
        STList,
        STListItem,
        STToolbar,
        Spinner,
        Checkbox,
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        date: Formatter.dateWithDay.bind(Formatter),
        dateTime: Formatter.dateTimeWithDay.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter),
        capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter)
    },
    directives: {
        LongPress: LongPressDirective
    }
})
export default class ValidTicketView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        webshopManager!: WebshopManager

    @Prop({ required: true })
        ticket!: TicketPrivate

    @Prop({ required: true })
        order!: PrivateOrder

    get recordAnswers() {
        return this.order.data.recordAnswers
    }

    get hasWarnings() {
        return this.warnings.length > 0
    }

    get warnings(): RecordWarning[] {
        const warnings: RecordWarning[] = []

        for (const answer of this.recordAnswers) {
            warnings.push(...answer.getWarnings())
        }

        return warnings
    }

    get sortedWarnings() {
        return this.warnings.slice().sort(RecordWarning.sort)
    }

    get isCanceled() {
        return this.order.status === OrderStatus.Canceled
    }

    get item() {
        return this.order.data.cart.items.find(i => i.id === this.ticket.itemId)
    }

    getName(paymentMethod: PaymentMethod): string {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod))
    }

    get actionBuilder() {
        return new OrderActionBuilder({
            webshopManager: this.webshopManager,
            component: this,
        })
    }

    get statusName() {
        return OrderStatusHelper.getName(this.order.status)
    }

    get statusColor() {
        return OrderStatusHelper.getColor(this.order.status)
    }

    get webshop() {
        return this.webshopManager.preview
    }

    get hasWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        return getPermissionLevelNumber(this.webshop.privateMeta.permissions.getPermissionLevel(p)) >= getPermissionLevelNumber(PermissionLevel.Write)
    }

    get hasPaymentsWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        if (p.canManagePayments(OrganizationManager.organization.privateMeta?.roles ?? []) || p.hasFullAccess()) {
            return true
        }
        return getPermissionLevelNumber(this.webshop.privateMeta.permissions.getPermissionLevel(p)) >= getPermissionLevelNumber(PermissionLevel.Write)
    }

    openPayment() {
        if (!this.hasPaymentsWrite) {
            return;
        }
        this.present({
            components: [
                new ComponentWithProperties(PaymentView, {
                    initialPayment: this.order.payment
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    markAs(event) {
        const el = (event.currentTarget as HTMLElement).querySelector(".right") ?? event.currentTarget;
        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            xPlacement: "left",
            yPlacement: "bottom",
            actions: this.actionBuilder.getStatusActions(),
            focused: [this.order]
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    changePaymentStatus(event) {
        const el = (event.currentTarget as HTMLElement).querySelector(".right") ?? event.currentTarget;
        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            xPlacement: "left",
            yPlacement: "bottom",
            actions: this.actionBuilder.getPaymentActions(),
            focused: [this.order]
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }


    async cancelScan() {
        if (this.ticket.scannedAt) {
            await this.webshopManager.addTicketPatch(TicketPrivate.patch({
                id: this.ticket.id,
                secret: this.ticket.secret, // needed for lookups
                scannedAt: null,
                scannedBy: null
            }))
        }
        this.pop({ force: true })
    }

    async markScanned() {
        if (!this.ticket.scannedAt) {
            await this.webshopManager.addTicketPatch(TicketPrivate.patch({
                id: this.ticket.id,
                secret: this.ticket.secret, // needed for lookups
                scannedAt: new Date(),
                scannedBy: SessionManager.currentSession!.user?.firstName ?? null
            }))
        }

        this.pop({ force: true })
    }

    openOrder() {
        this.present({
            components: [
                new ComponentWithProperties(OrderView, {
                    initialOrder: PrivateOrderWithTickets.create(this.order),
                    webshopManager: this.webshopManager,
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    mounted() {
        ColorHelper.setColor("#0CBB69", this.$el as HTMLElement)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.valid-ticket-view {
    // background: $color-success-background;
    // --color-current-background: #{$color-success-background};
    //--color-current-background-shade: #{$color-success-background-shade};

    // color: $color-success-dark;

    > main {
        > h1 {
            text-align: center;
            padding-bottom: 0 !important;

            span {
                display: block;

                &.icon {
                    display: inline-block;
                    font-size: 64px;
                    width: 64px;
                }
            }
        }
    }

    .ticket-secret {
        text-align: center;
        color: $color-gray-text;
        font-size: 10px;
        font-weight: bold;
        padding-bottom: 20px;
        padding-top: 5px;
    }

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
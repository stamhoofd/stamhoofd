<template>
    <div class="st-view valid-ticket-view">
        <STNavigationBar title="Geldig ticket">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main v-if="!ticket.itemId">
            <h1>
                <span class="icon green success" />
                <span>Bestelling {{ order.number }}</span>
            </h1>

            <p v-if="order.status == 'Completed'" class="warning-box">
                Deze bestelling werd al als voltooid gemarkeerd
            </p>
            <p v-if="order.status == 'Canceled'" class="error-box">
                Deze bestelling werd geannuleerd
            </p>

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

            <STList>
                <STListItem class="right-description">
                    Naam

                    <template slot="right">
                        <p>{{ order.data.customer.name }}</p>
                        <p>{{ order.data.customer.phone }}</p>
                        <p>{{ order.data.customer.email }}</p>
                    </template>
                </STListItem>
                <STListItem class="right-description">
                    Status

                    <template slot="right">
                        <span v-if="order.status == 'Created'" class="style-tag">Nieuw</span>
                        <span v-if="order.payment && order.payment.status !== 'Succeeded'" class="style-tag warn">Niet betaald</span>
                        <span v-if="order.status == 'Prepared'" class="style-tag">Verwerkt</span>
                        <span v-if="order.status == 'Collect'" class="style-tag">Ligt klaar</span>
                        <span v-if="order.status == 'Completed'" v-tooltip="'Voltooid'" class="success icon green" />
                        <span v-if="order.status == 'Canceled'" v-tooltip="'Geannuleerd'" class="error icon canceled" />
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
                <STListItem v-if="order.validAt" class="right-description">
                    Geplaatst op
                    <template slot="right">
                        {{ order.validAt | dateTime | capitalizeFirstLetter }}
                    </template>
                </STListItem>
                <template v-if="order.data.checkoutMethod">
                    <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                        <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                            Afhaallocatie
                        </template>
                        <template v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                            Locatie
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
                        <template v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                            Wanneer?
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
        </main>

        <main v-else-if="item">
            <h1>
                <span class="icon green success" />
                <span>{{ item.product.name }}</span>
            </h1>
            <p class="ticket-secret">
                {{ ticket.secret }}
            </p>

            <STList class="info">
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
            <button v-if="!ticket.scannedAt" slot="right" class="button secundary" @click="cancelScan">
                Niet markeren
            </button>
            <button v-else slot="right" class="button secundary" @click="cancelScan">
                Markering ongedaan maken
            </button>
            <button slot="right" class="button primary" @click="markScanned">
                <span class="icon qr-code" />
                <span>Markeer als gescand</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ColorHelper,Spinner,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Order, PaymentMethod, PaymentMethodHelper, TicketPrivate } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { WebshopManager } from "../../WebshopManager";

@Component({
    components: {
        STNavigationBar,
        BackButton,
        STList,
        STListItem,
        STToolbar,
        Spinner,
        Checkbox
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
export default class ValidTicketView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    webshopManager!: WebshopManager

    @Prop({ required: true })
    ticket!: TicketPrivate

    @Prop({ required: true })
    order!: Order

    get item() {
        return this.order.data.cart.items.find(i => i.id === this.ticket.itemId)
    }

    getName(paymentMethod: PaymentMethod): string {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod))
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

    mounted() {
        ColorHelper.setColor("#0CBB69", this.$el as HTMLElement)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.valid-ticket-view {
    background: $color-success-background;
    --color-current-background: #{$color-success-background};
    //--color-current-background-shade: #{$color-success-background-shade};

    color: $color-success-dark;

    > main {
        > h1 {
            color: $color-success-dark;
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
        color: $color-gray;
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
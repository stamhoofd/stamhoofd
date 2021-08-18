<template>
    <div class="st-view valid-ticket-view">
        <STNavigationBar title="Geldig ticket">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main v-if="!ticket.itemId">
            <h1>
                Bestelling {{ order.number }}
            </h1>
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
import { Order, Ticket, TicketPrivate } from "@stamhoofd/structures";
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
}
</style>
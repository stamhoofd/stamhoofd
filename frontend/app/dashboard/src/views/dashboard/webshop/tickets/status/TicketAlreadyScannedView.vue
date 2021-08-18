<template>
    <div class="st-view ticket-already-scanned-view">
        <STNavigationBar title="Ticket al gescand">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                <span class="icon warning yellow" />
                <span>Ticket al gescand</span>
            </h1>
            <p>
                Let op dat je hetzelfde ticket niet meerdere keren scant en zo hergebruik van een ticket mogelijk maakt.
            </p>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Tijdstip
                    </h3>
                    <p class="style-definition-text">
                        {{ ticket.scannedAt }}
                    </p>
                </STListItem>

                <STListItem v-if="ticket.scannedBy">
                    <h3 class="style-definition-label">
                        Gescand door
                    </h3>
                    <p class="style-definition-text">
                        {{ ticket.scannedBy }}
                    </p>
                </STListItem>
            </STList>
        </main>
       

        <STToolbar>
            <button slot="right" class="button secundary" @click="viewTicket">
                Ticket toch bekijken
            </button>
            <button slot="right" class="button primary" @click="pop">
                Terug
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ColorHelper,Spinner,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Order, TicketPrivate } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { WebshopManager } from "../../WebshopManager";
import ValidTicketView from "./ValidTicketView.vue";

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
export default class TicketAlreadyScannedView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    webshopManager!: WebshopManager

    @Prop({ required: true })
    ticket!: TicketPrivate

    @Prop({ required: true })
    order!: Order

    get item() {
        return this.order.data.cart.items.find(i => i.id === this.ticket.itemId)
    }

    viewTicket() {
        this.navigationController!.push(new ComponentWithProperties(ValidTicketView, {
            webshopManager: this.webshopManager,
            ticket: this.ticket,
            order: this.order
        }), true, 1)
    }

    mounted() {
        ColorHelper.setColor("#ffc900", this.$el as HTMLElement)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.ticket-already-scanned-view {
    background: $color-warning-background;
    --color-current-background: #{$color-warning-background};
    //--color-current-background-shade: #{$color-success-background-shade};

    color: $color-warning-dark;

    > main {
        > h1 {
            color: $color-warning-dark;
            text-align: center;

            span {
                display: block;

                &.icon {
                    display: inline-block;
                    font-size: 64px;
                    width: 64px;
                }
            }

            + p {
                text-align: center;
            }
        }
    }
}
</style>
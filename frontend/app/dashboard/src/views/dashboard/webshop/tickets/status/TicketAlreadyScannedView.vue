<template>
    <div class="st-view ticket-already-scanned-view">
        <STNavigationBar title="Ticket al gescand" :pop="canPop" />

        <main>
            <h1>
                <span class="icon warning yellow" />
                <span>Ticket al gescand</span>
            </h1>
            <p class="ticket-secret">
                {{ ticket.secret }}
            </p>
            <p class="style-description">
                Let op dat je hetzelfde ticket niet meerdere keren scant en zo hergebruik van een ticket mogelijk maakt.
            </p>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Tijdstip
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateTime(ticket.scannedAt) }}
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
            <template #right>
                <button class="button secundary" @click="viewTicket">
                    Ticket toch bekijken
                </button>
                <button class="button primary" @click="pop">
                    Terug
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ColorHelper,Spinner,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { PrivateOrder, TicketPrivate, TicketPublicPrivate } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

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
        ticket!: TicketPrivate|TicketPublicPrivate

    @Prop({ required: true })
        order!: PrivateOrder

    formatDateTime(date: Date) {
        return Formatter.capitalizeFirstLetter(Formatter.dateTimeWithDay(date))
    }

    viewTicket() {
        this.show({
            components: [
                new ComponentWithProperties(ValidTicketView, {
                    webshopManager: this.webshopManager,
                    ticket: this.ticket,
                    order: this.order
                })
            ], 
            replace: 1, 
            force: true
        })
    }

    mounted() {
        ColorHelper.setColor("#ffc900", this.$el as HTMLElement)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.ticket-already-scanned-view {
    //--color-current-background-shade: #{$color-success-background-shade};
    > main {
        > h1 {
            color: $color-warning-dark;
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

            + p {
                text-align: center;
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
}
</style>
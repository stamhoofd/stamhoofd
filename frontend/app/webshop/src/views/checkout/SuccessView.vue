<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Jippie! Jouw bestelling is geplaatst!</h1>

                
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span>Bestelling bekijken</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar, PaymentSelectionList, PaymentHandler } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Group, KeychainedResponse, MemberWithRegistrations, Order, OrderData, OrderResponse, Payment, PaymentMethod, PaymentStatus, Record, RecordType, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup, WebshopTakeoutMethod, WebshopTimeSlot, WebshopTimeSlots } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import OrderView from '../orders/OrderView.vue';
import MemberGeneralView from '../registration/MemberGeneralView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        PaymentSelectionList
    },
    filters: {
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class SuccessView extends Mixins(NavigationMixin){
    isStepsPoppable = false
    loading = false
    errorBox: ErrorBox | null = null
    CheckoutManager = CheckoutManager

    @Prop({ default: null })
    order: Order | null

    @Prop({ default: null })
    orderId: string | null

    @Prop({ default: null })
    paymentId: string | null

    mounted() {
        // Clear cart
        CheckoutManager.cart.items = []
        CheckoutManager.saveCheckout()
    }
   
    async goNext() {
        this.navigationController!.push(new ComponentWithProperties(OrderView, { orderId: this.orderId, paymentId: this.paymentId, initialOrder: this.order }), true, this.navigationController!.components!.length - 1)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
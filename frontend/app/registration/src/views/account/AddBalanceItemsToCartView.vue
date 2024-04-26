<template>
    <div class="st-view choose-balance-items-view">
        <STNavigationBar :pop="canPop" :dismiss="canDismiss" title="Mijn account" />
        <main>
            <h1>Welke openstaande bedragen wil je nu betalen?</h1>
            <p>Betaal bij voorkeur alles in één keer, maar indien niet mogelijk kan je in stukken betalen die je zelf kiest.</p>


            <STList>
                <STListItem v-for="item in outstandingItems" :key="item.id" :selectable="true" element-name="label">
                    <Checkbox slot="left" :checked="isItemSelected(item)" @change="setItemSelected(item, $event)" />
                    <h3 class="style-title-list">
                        {{ item.description }}
                    </h3>
                    <p v-if="item.memberId && getMember(item.memberId) && multipleMembers" class="style-description-small">
                        {{ getMember(item.memberId).name }}
                    </p>
                    <p class="style-description-small">
                        {{ formatDate(item.createdAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ formatPrice(item.price) }}
                    </p>
                </STListItem>
            </STList>

            <div class="pricing-box">
                <STList>
                    <STListItem>
                        Totaal nu betalen

                        <template slot="right">
                            {{ formatPrice(totalSelected) }}
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>
        <STToolbar>
            <button slot="right" class="button primary full" type="button" :disabled="totalSelected === 0" @click="startPayment">
                <span>Toevoegen</span>
                <span class="icon arrow-right" />
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { BalanceItemCartItem, MemberBalanceItem } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";


import CartView from "../checkout/CartView.vue";

@Component({
    components: {
        STList,
        STListItem,
        STErrorsDefault,
        STNavigationBar,
        STToolbar,
        Checkbox
    },
    filters: {
        price: Formatter.price
    }
})
export default class AddBalanceItemsToCartView extends Mixins(NavigationMixin){
    

    @Prop(({required: true}))
        balanceItems: MemberBalanceItem[]

    selectedItems: BalanceItemCartItem[] = []

    created() {
        // Select all
        this.selectedItems = this.balanceItems.flatMap(item => {
            const price = MemberBalanceItem.getOutstandingBalance([item]).totalOpen
            if (price === 0) {
                return [];
            }
            return [
                BalanceItemCartItem.create({
                    item,
                    price
                })
            ]
        })
    }

    get multipleMembers() {
        return (this.$memberManager.members?.length ?? 0) > 1
    }

    getMember(memberId: string) {
        return this.$memberManager.members?.find(m => m.id === memberId)
    }

    get outstandingItems() {
        return this.balanceItems.filter(i => !i.isPaid)
    }
    
    get organization() {
        return this.$organization
    }    

    formatDate(date: Date) {
        return Formatter.date(date, true)
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    isItemSelected(item: MemberBalanceItem) {
        return !!this.selectedItems.find(s => s.item.id === item.id && s.price !== 0)
    }

    get totalSelected() {
        return this.selectedItems.reduce((a, b) => a + b.price, 0)
    }

    setItemSelected(item: MemberBalanceItem, selected: boolean) {
        if (selected === this.isItemSelected(item)) {
            return
        }
        const arr = this.selectedItems.filter(s => s.item.id !== item.id)
        if (selected) {
            const price = MemberBalanceItem.getOutstandingBalance([item]).totalOpen
            if (price === 0) {
                return;
            }
            arr.push(BalanceItemCartItem.create({
                item,
                price
            }))
            this.selectedItems = arr
        } else {
            this.selectedItems = arr
        }
    }

    startPayment() {
        for (const item of this.selectedItems) {
            this.$checkoutManager.cart.addBalanceItem(item)
        }
        this.$checkoutManager.saveCart()
        this.show({
            components: [
                new ComponentWithProperties(CartView, {})
            ],
            replace: this.navigationController?.components?.length ?? 0
        })
    }
}
</script>

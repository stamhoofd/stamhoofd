<template>
    <div class="st-view cart-view">
        <main class="limit-width">
            <section class="view">
                <STNavigationBar :title="title">
                    <span v-if="cart.items.length > 0" slot="left" class="style-tag">{{ cart.price | price }}</span>
                </STNavigationBar>

                <main>
                    <h1>{{ title }}</h1>

                    <p>Voeg alle inschrijvingen toe aan het mandje en reken in één keer af.</p>

                    <p v-if="cart.items.length == 0" class="info-box">
                        Jouw inschrijvings-mandje is leeg. Schrijf een lid in via het tabblad 'inschrijven'.
                    </p>
                    <STErrorsDefault :error-box="errorBox" />
                
                    <STList>
                        <STListItem v-for="item in cart.items" :key="item.id" class="cart-item-row">
                            <h3>
                                <span>{{ item.member.name }}</span>
                            </h3>
                            <p class="description" v-text="'€ 40,00'" />

                            <footer>
                                <p class="price">
                                    {{ item.waitingList ? "Wachtlijst van " : "" }}{{ item.group.settings.name }}
                                </p>
                                <div @click.stop>
                                    <button class="button icon trash gray" @click="deleteItem(item)" />
                                </div>
                            </footer>

                            <figure v-if="imageSrc(item)" slot="right">
                                <img :src="imageSrc(item)">
                            </figure>
                        </STListItem>
                    </STList>
                </main>

                <STToolbar v-if="cart.items.length > 0">
                    <span slot="left">Totaal: {{ cart.price | price }}</span>
                    <LoadingButton slot="right" :loading="loading">
                        <button class="button primary" @click="goToCheckout">
                            <span class="icon flag" />
                            <span>Afrekenen</span>
                        </button>
                    </LoadingButton>
                </STToolbar>
            </section>
        </main>
    </div>
</template>


<script lang="ts">
import { HistoryManager, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ErrorBox, LoadingButton,StepperInput,STErrorsDefault,STList, STListItem,STNavigationBar, STToolbar } from '@stamhoofd/components';
import { RegisterItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component } from 'vue-property-decorator';
import { Mixins } from 'vue-property-decorator';

import { CheckoutManager } from '../../classes/CheckoutManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        STErrorsDefault,
        LoadingButton,
        StepperInput
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class CartView extends Mixins(NavigationMixin){
    CheckoutManager = CheckoutManager

    title = "Inschrijvingsmandje"
    loading = false
    errorBox: ErrorBox | null = null

    get cart() {
        return this.CheckoutManager.cart
    }

    async goToCheckout() { 
        if (this.loading) {
            return
        }
        this.loading = true
        this.errorBox = null

         try {
            // todo: go to checkout ;)
            await Promise.resolve()
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    imageSrc(item: RegisterItem): string | null {
        return (item.group.settings.squarePhoto ?? item.group.settings.coverPhoto)?.getPathForSize(100, 100) ?? null
    }

    deleteItem(RegisterItem: RegisterItem) {
        CheckoutManager.cart.removeItem(RegisterItem)
        CheckoutManager.saveCart()
    }

    activated() {
        console.log("set cart url")
        this.$nextTick(() => {
            HistoryManager.setUrl("/cart")
        })
    }

    mounted() {
        try {
            this.cart.validate()
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        CheckoutManager.saveCart()
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-view {
    .cart-item-row {
        h3 {
            padding-top: 5px;
            @extend .style-title-3;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
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
            color: $color-primary;
        }

        footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        img {
            width: 70px;
            height: 70px;
            border-radius: $border-radius;
            object-fit: cover;

            @media (min-width: 340px) {
                width: 80px;
                height: 80px;
            }

            @media (min-width: 801px) {
                width: 100px;
                height: 100px;
            }
        }
    }
}

</style>
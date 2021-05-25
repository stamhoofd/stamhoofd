<template>
    <div class="st-view cart-item-view">
        <STNavigationBar :title="cartItem.product.name">
            <span slot="left" class="style-tag">{{ cartItem.getUnitPrice(cart) | price }}</span>
            <button slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>
        <main>
            <h1>{{ cartItem.product.name }}</h1>

            <figure v-if="imageSrc" class="image-box">
                <div :style="{ paddingBottom: Math.min(image.height/image.width*100, 100)+'%'}">
                    <img :src="imageSrc">
                </div>
            </figure>
            <p class="description">
                {{ cartItem.product.description }}
            </p>
            <hr>

            <div v-if="cartItem.product.prices.length > 1" class="container">
                <STList>
                    <STListItem v-for="price in cartItem.product.prices" :key="price.id" class="no-border right-description" :selectable="true" element-name="label">
                        <Radio slot="left" v-model="cartItem.productPrice" :value="price" :name="cartItem.product.id+'price'" />
                        <h4 class="style-title-list">
                            {{ price.name || 'Naamloos' }}
                        </h4>

                        <p v-if="price.discountPrice" class="style-description-small">
                            {{ price.discountPrice | price }} / stuk vanaf {{ price.discountAmount }} {{ price.discountAmount == 1 ? 'stuk' : 'stuks' }}
                        </p>

                        <template slot="right">
                            {{ price.price | price }}
                        </template>
                    </STListItem>
                </STList>
                <hr>
            </div>

            <OptionMenuBox v-for="optionMenu in cartItem.product.optionMenus" :key="optionMenu.id" :cart-item="cartItem" :option-menu="optionMenu" />

            <h2>Aantal</h2>

            <p v-if="remainingReduced > 0" class="info-box">
                Bestel {{ cartItem.productPrice.discountAmount }} {{ cartItem.productPrice.discountAmount == 1 ? 'stuk' : 'stuks' }}, en betaal maar {{ discountPrice | price }} per stuk!
            </p>

            <NumberInput v-model="cartItem.amount" suffix="stuks" suffix-singular="stuk" :max="maximumRemaining" :min="1" :stepper="true" />
            <p v-if="maximumRemaining !== null && cartItem.amount + 1 >= maximumRemaining" class="st-list-description">
                Er zijn nog maar {{ remainingStock }} {{ remainingStock == 1 ? 'stuk' : 'stuks' }} beschikbaar<template v-if="count > 0">
                    , waarvan er al {{ count }} in jouw winkelmandje zitten
                </template>
            </p>
        </main>

        <STToolbar :sticky="oldItem ? true : false">
            <button v-if="oldItem" slot="right" class="button primary" @click="addToCart">
                <span class="icon basket" />
                <span>Opslaan</span>
            </button>
            <button v-else slot="right" class="button primary" @click="addToCart">
                <span class="icon basket" />
                <span>Toevoegen</span>
            </button>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { NumberInput,Radio,StepperInput,STList, STListItem,STNavigationBar, STToolbar, Toast} from '@stamhoofd/components';
import { CartItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop } from 'vue-property-decorator';
import { Mixins } from 'vue-property-decorator';

import { CheckoutManager } from '../../classes/CheckoutManager';
import OptionMenuBox from './OptionMenuBox.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        NumberInput,
        OptionMenuBox,
        StepperInput
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class CartItemView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    cartItem: CartItem

    @Prop({ default: null })
    oldItem: CartItem | null

    get cart() {
        return CheckoutManager.cart
    }

    addToCart() {
        if (this.oldItem) {
            CheckoutManager.cart.removeItem(this.oldItem)
            new Toast(this.cartItem.product.name+" is aangepast", "success green").setHide(1000).show()
        } else {
            new Toast(this.cartItem.product.name+" is toegevoegd aan je winkelmandje", "success green").setHide(2000).show()
        }
        CheckoutManager.cart.addItem(this.cartItem)
        CheckoutManager.saveCart()
        this.pop()
    }

    get image() {
        return this.cartItem.product.images[0]?.getResolutionForSize(500, undefined)
    }

    get imageSrc() {
        return this.image?.file?.getPublicPath()
    }

    get product() {
        return this.cartItem.product
    }

    get remainingReduced() {
        if (this.cartItem.productPrice.discountPrice === null) {
            return 0
        }
        return this.cartItem.productPrice.discountAmount - this.count
    }

    get discountPrice() {
        return this.cartItem.productPrice.discountPrice ?? 0
    }

    get count() {
        return CheckoutManager.cart.items.reduce((prev, item) => {
            if (item.product.id != this.product.id) {
                return prev
            }
            return prev + item.amount
        }, 0)  - (this.oldItem?.amount ?? 0)
    }

    get maximumRemaining() {
        if (this.product.remainingStock === null) {
            return null
        }

        return this.product.remainingStock - this.count
    }

    get remainingStock() {
        return this.product.remainingStock 
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-item-view {
    --st-horizontal-padding: 25px;

    .image-box {
        position: relative;
        max-height: 300px;

        > div {
            display: flex;
            flex-direction: row;
            justify-content: center;
        }

        img {
            position: absolute;
            height: 100%;
            border-radius: $border-radius;
            width: 100%;
            object-fit: cover;
        }
    }
    .image {
        width: 100%;
        border-radius: $border-radius;
    }

    .description {
        @extend .style-description;
        padding-top: 15px;
    }
}

</style>
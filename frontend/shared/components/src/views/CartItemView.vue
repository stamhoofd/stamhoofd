<template>
    <form class="st-view cart-item-view" @submit.prevent="addToCart">
        <STNavigationBar :title="cartItem.product.name" :pop="canPop" :dismiss="canDismiss">
            <span v-if="!webshop.isAllFree || cartItem.calculateUnitPrice(cart)" slot="left" class="style-tag">{{ cartItem.calculateUnitPrice(cart) | priceFree }}</span>
        </STNavigationBar>
        <main>
            <h1>{{ cartItem.product.name }}</h1>

            <figure v-if="imageSrc" class="image-box">
                <div>
                    <img :src="imageSrc" :width="image.width" :height="image.height">
                </div>
            </figure>
            <p v-if="cartItem.product.description" class="description" v-text="cartItem.product.description" />

            <p v-if="oldItem && oldItem.cartError" class="error-box small">
                {{ oldItem.cartError.getHuman() }}
            </p>


            <p v-if="!cartItem.product.isEnabled" class="info-box">
                {{ cartItem.product.isEnabledTextLong }}
            </p>

            <p v-else-if="cartItem.product.isSoldOut" class="warning-box">
                Dit artikel is uitverkocht
            </p>

            <p v-else-if="areSeatsSoldOut" class="warning-box">
                Alle plaatsen zijn volzet
            </p>

            <p v-else-if="!canOrder" class="warning-box">
                Je hebt het maximaal aantal stuks bereikt dat je nog kan bestellen van dit artikel
            </p>

            <p v-else-if="cartItem.product.closesSoonText" class="info-box">
                {{ cartItem.product.closesSoonText }}
            </p>

            <p v-if="remainingReduced > 0" class="info-box">
                Bestel je {{ cartItem.productPrice.discountAmount }} of meer stuks, dan betaal je maar {{ discountPrice | price }} per stuk!
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <STList v-if="(cartItem.product.type == 'Ticket' || cartItem.product.type == 'Voucher') && cartItem.product.location" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Locatie
                    </h3>
                    <p class="style-definition-text">
                        {{ cartItem.product.location.name }}
                    </p>
                    <p v-if="cartItem.product.location.address" class="style-description-small">
                        {{ cartItem.product.location.address }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Wanneer?
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateRange(cartItem.product.dateRange) }}
                    </p>
                </STListItem>
            </STList>

            <div v-if="cartItem.product.filteredPrices({admin}).length > 1" class="container">
                <hr>
                <STList>
                    <STListItem v-for="price in cartItem.product.filteredPrices({admin})" :key="price.id" class="no-border right-price" :selectable="canSelectPrice(price)" :disabled="!canSelectPrice(price)" element-name="label">
                        <Radio slot="left" v-model="cartItem.productPrice" :value="price" :name="cartItem.product.id+'price'" :disabled="!canSelectPrice(price)" />
                        <h4 class="style-title-list">
                            {{ price.name || 'Naamloos' }}
                        </h4>

                        <p v-if="price.discountPrice" class="style-description-small">
                            {{ price.discountPrice | price }} / stuk vanaf {{ price.discountAmount }} {{ price.discountAmount == 1 ? 'stuk' : 'stuks' }}
                        </p>

                        <p v-if="getPriceStockText(price)" class="style-description-small">
                            {{ getPriceStockText(price) }}
                        </p>

                        <template slot="right">
                            {{ price.price | price }}
                        </template>
                    </STListItem>
                </STList>
            </div>

            <OptionMenuBox v-for="optionMenu in cartItem.product.optionMenus" :key="optionMenu.id" :cart-item="cartItem" :option-menu="optionMenu" :cart="cart" :old-item="oldItem" :admin="admin" :webshop="webshop" />

            <FieldBox v-for="field in cartItem.product.customFields" :key="field.id" :field="field" :answers="cartItem.fieldAnswers" :error-box="errorBox" />

            <template v-if="canOrder && canSelectAmount">
                <hr>
                <h2>Aantal</h2>

                <NumberInput v-model="cartItem.amount" :suffix="suffix" :suffix-singular="suffixSingular" :max="maximumRemaining" :min="1" :stepper="true" />

                <p v-if="stockText" class="st-list-description" v-text="stockText" />
            </template>

            <div v-if="!cartEnabled && (administrationFee || (canSelectAmount && !webshop.isAllFree))" class="pricing-box max">
                <STList>
                    <STListItem v-if="administrationFee">
                        Administratiekosten

                        <template slot="right">
                            {{ administrationFee | price }}
                        </template>
                    </STListItem>

                    <STListItem>
                        Totaal

                        <template slot="right">
                            {{ (totalPrice + administrationFee) | price }}
                        </template> 
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar v-if="canOrder">
            <button v-if="willNeedSeats" slot="right" class="button primary" type="submit">
                <span>Kies plaatsen</span>
                <span class="icon arrow-right" />
            </button>
            <button v-else-if="oldItem && cartEnabled" slot="right" class="button primary" type="submit">
                <span class="icon basket" />
                <span>Opslaan</span>
            </button>
            <button v-else slot="right" class="button primary" type="submit">
                <span v-if="cartEnabled" class="icon basket" />
                <span v-if="cartEnabled">Toevoegen</span>
                <span v-else>Doorgaan</span>
                <span v-if="!cartEnabled" class="icon arrow-right" />
            </button>
        </STToolbar>
    </form>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { BackButton, ErrorBox, NumberInput, Radio, StepperInput, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Cart, CartItem, CartStockHelper, ProductDateRange, ProductPrice, ProductType, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from 'vue-property-decorator';

import ChooseSeatsView from './ChooseSeatsView.vue';
import FieldBox from './FieldBox.vue';
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
        StepperInput,
        FieldBox,
        STErrorsDefault,
        BackButton
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        priceFree: (p: number) => {
            if (p === 0) {
                return "Gratis"
            }
            return Formatter.price(p);
        }
    }
})
export default class CartItemView extends Mixins(NavigationMixin){
    @Prop({ default: false })
        admin: boolean
        
    @Prop({ required: true })
        cartItem: CartItem

    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        cart: Cart

    @Prop({ required: true })
        saveHandler: (newItem: CartItem, oldItem: CartItem | null, component) => void

    @Prop({ default: null })
        oldItem: CartItem | null

    errorBox: ErrorBox | null = null

    get willNeedSeats() {
        return this.withSeats
    }

    pluralText(num: number, singular: string, plural: string) {
        return Formatter.pluralText(num, singular, plural)
    }

    addToCart() {
        if (this.willNeedSeats) {
            this.chooseSeats();
            return;
        }
        try {
            this.saveHandler(this.cartItem, this.oldItem, this)
        } catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e)
            return
        }
        this.errorBox = null // required if dismiss is disabled
        //this.dismiss({ force: true })
    }

    chooseSeats() {
        const component = new ComponentWithProperties(ChooseSeatsView, {
            cartItem: this.cartItem,
            oldItem: this.oldItem,
            webshop: this.webshop,
            admin: this.admin,
            cart: this.cart,
            saveHandler: this.saveHandler
        });

        if (!this.canDismiss) {
            this.present({
                components: [
                    component
                ],
                modalDisplayStyle: "sheet"
            })
        } else {
            // Sheet
            this.show({
                components: [
                    component
                ]
            })
        }
    }

    get cartEnabled() {
        return this.webshop.shouldEnableCart
    }

    get withSeats() {
        return this.cartItem.product.seatingPlanId !== null
    }

    get suffixSingular() {
        if (this.cartItem.product.type == ProductType.Ticket) {
            return "ticket"
        }
        return this.cartItem.product.type == ProductType.Person ? 'persoon' : 'stuk'
    }

    get suffix() {
        if (this.cartItem.product.type == ProductType.Ticket) {
            return "tickets"
        }
        return this.cartItem.product.type == ProductType.Person ? 'personen' : 'stuks'
    }

    get image() {
        return this.cartItem.product.images[0]?.getResolutionForSize(600, undefined)
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

    /**
     * Return the total amount of this same product in the cart, that is not this item (if it is editing)
     */
    get count() {
        return this.cart.items.reduce((prev, item) => {
            if (item.product.id != this.product.id) {
                return prev
            }
            return prev + item.amount
        }, 0)  - (this.oldItem?.amount ?? 0)
    }

    get availableStock() {
        return this.cartItem.getAvailableStock(this.oldItem, this.cart, this.webshop, this.admin)
    }

    get maximumRemaining() {
        return this.cartItem.getMaximumRemaining(this.oldItem, this.cart, this.webshop, this.admin)
    }

    get maximumRemainingAcrossOptions() {
        return CartStockHelper.getRemainingAcrossOptions({
            product: this.product,
            oldItem: this.oldItem,
            cart: this.cart,
            webshop: this.webshop,
            admin: this.admin,
            amount: this.cartItem.amount
        }, {inMultipleCartItems: false})
    }

    get stockText() {
        const maximumRemaining = this.maximumRemaining
        return this.availableStock.filter(v => v.text !== null && (!v.remaining || !maximumRemaining || v.remaining <= maximumRemaining)).map(s => s.text)[0]
    }

    getPriceStock(price: ProductPrice) {
        const priceStock = CartStockHelper.getPriceStock({product: this.product, oldItem: this.oldItem, cart: this.cart, productPrice: price, webshop: this.webshop, admin: this.admin, amount: this.cartItem.amount})
        if (!priceStock) {
            return null
        }

        if (priceStock.remaining !== null && this.maximumRemainingAcrossOptions !== null && priceStock.remaining > this.maximumRemainingAcrossOptions) {
            // Doesn't matter to show this
            return null;
        }
        return priceStock
    }

    getPriceStockText(price: ProductPrice) {
        // Don't show text if all options are sold out
        if (this.maximumRemainingAcrossOptions === 0) {
            return null
        }

        return this.getPriceStock(price)?.shortText
    }

    canSelectPrice(price: ProductPrice) {
        if (this.maximumRemainingAcrossOptions === 0) {
            return false
        }

        return this.getPriceStock(price)?.remaining !== 0
    }

    formatDateRange(dateRange: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(dateRange.toString())
    }

    get areSeatsSoldOut() {
        return CartStockHelper.getSeatsStock({product: this.product, oldItem: this.oldItem, cart: this.cart, webshop: this.webshop, admin: this.admin, amount: this.cartItem.amount})?.stock === 0
    }

    get canOrder() {
        return (this.maximumRemaining === null || this.maximumRemaining > 0) && (this.product.isEnabled || this.admin)
        //return (this.admin || ((this.maximumRemaining === null || this.maximumRemaining > 0 || !!this.oldItem) && this.product.isEnabled)) && !this.areSeatsSoldOut
    }

    get canSelectAmount() {
        return this.product.maxPerOrder !== 1 && this.product.allowMultiple
    }

    get totalPrice() {
        return this.cartItem.getPrice(this.cart)
    }

    get administrationFee() {
        return this.webshop.meta.paymentConfiguration.administrationFee.calculate(this.cartItem.getPrice(this.cart))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-item-view {
    .sheet & {
       --st-horizontal-padding: 25px;
    }

    .image-box {
        position: relative;
        overflow: hidden;
        border-radius: $border-radius;

        > div {
            display: flex;
            flex-direction: row;
            justify-content: center;
        }

        img {
            height: auto;
            max-width: 100%;
            border-radius: $border-radius;
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
        white-space: pre-wrap;
    }

    .info {
        padding-top: 15px;
    }

    h1 + .description {
        // Remove duplicate padding
        padding-top: 0;
    }

    h1 + .info {
        padding-top: 0;
    }

    .pricing-box {
        padding-top: 15px;
    }
}

</style>
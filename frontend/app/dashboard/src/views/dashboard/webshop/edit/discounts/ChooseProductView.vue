<template>
    <div class="st-view" >
        <STNavigationBar :title="title" :pop="canPop" :dismiss="canDismiss" />
           
        <main>
            <h1>
                {{title}}
            </h1>
            
            <div v-for="category of categories" :key="category.id" class="container">
                <hr v-if="categories.length > 1">
                <h2 v-if="categories.length > 1">
                    {{ category.name }}
                </h2>
                <STList>
                    <STListItem v-for="product in getCategoryProducts(category)" :key="product.id" :selectable="true" element-name="label" @click="selectProduct(product)">
                        <h3 class="style-title-list">
                            {{ product.name }}
                        </h3>
                        <p v-if="(product.type == 'Ticket' || product.type == 'Voucher') && product.location" class="style-description-small" v-text="product.location.name" />
                        <p v-if="(product.type == 'Ticket' || product.type == 'Voucher') && product.dateRange" class="style-description-small" v-text="formatDateRange(product.dateRange)" />

                        <template v-if="product.id == selectedProductId" #right><span class="icon success primary" /></template>
                    </STListItem>
                </STList>
            </div>

        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STList, STListItem, STNavigationBar } from "@stamhoofd/components";
import { Category, PrivateWebshop, Product, ProductDateRange } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
        STList,
        STListItem,
        STNavigationBar,
        
    },
})
export default class ChooseProductView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        webshop: PrivateWebshop

    @Prop({ default: null})
        selectedProductId: string|null

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (selected: Product) => void;
    
    get title() {
        return 'Selecteer een artikel'
    }

    get categories() {
        const categories = this.webshop.categories.filter(c => this.getCategoryProducts(c).length > 0) ?? []
        if (categories.length <= 0) {
            return [
                Category.create({
                    name: '',
                    productIds: this.webshop.products.map(p => p.id)
                })
            ]
        }
        return categories;
    }

    getCategoryProducts(category: Category) {
        return category.productIds.flatMap(p => {
            const product = this.webshop.products.find(pp => pp.id === p)
            if (product) {
                return [product]
            }
            return []
        })
    }

    formatDateRange(dateRange: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(dateRange.toString())
    }

    selectProduct(product: Product) {
        this.saveHandler(product);
        this.pop({force: true})
    }
    
}
</script>
<template>
    <div class="st-view">
        <STNavigationBar title="Tickets scannen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Tickets scannen
            </h1>
            
            <Spinner v-if="(isLoading && shouldFilter) || isChecking" />
            <p v-else-if="shouldFilter && !isLoading && ticketProducts.length > 1">
                Vink hieronder de tickets aan die je wilt scannen en klik op "starten". Zo scan je niet per ongeluk een ongeldig ticket als je verschillende scanpunten hebt op je evenement (bv. drankkaarten en inkomtickets apart).
            </p>
            <p v-else>
                Klik op "starten" om te beginnen.
            </p>

            <p v-if="noDatabaseSupport" class="error-box">
                Dit appartaat ondersteunt de scanner niet. Probeer in een moderne browser, op een smartphone en zorg ervoor dat je niet in privé modus surft (dat voorkomt de noodzakelijk opslag van tickets als het internet wegvalt).
            </p>

            <a class="info-box icon download selectable" href="https://files.stamhoofd.be/website/docs/tickets-checklist.pdf" download="tickets-checklist.pdf" target="_blank">
                Download de checklist voor het scannen van tickets
            </a>

            <template v-if="shouldFilter && !isLoading && ticketProducts.length > 1">
                <div v-for="category of categories" :key="category.id" class="container">
                    <hr v-if="categories.length > 1">
                    <h2 v-if="categories.length > 1">
                        {{ category.name }}
                    </h2>
                    <STList>
                        <STListItem v-for="product in getCategoryProducts(category)" :key="product.id" :selectable="true" element-name="label">
                            <Checkbox slot="left" :checked="isProductSelected(product)" @change="setProductSelected(product, $event)" />

                            <h3 class="style-title-list">
                                {{ product.name }}
                            </h3>
                            <p v-if="(product.type == 'Ticket' || product.type == 'Voucher') && product.location" class="style-description-small" v-text="product.location.name" />
                            <p v-if="(product.type == 'Ticket' || product.type == 'Voucher') && product.dateRange" class="style-description-small" v-text="formatDateRange(product.dateRange)" />
                        </STListItem>
                    </STList>
                </div>
            </template>
        </main>

        <STToolbar v-if="!noDatabaseSupport">
            <button slot="right" class="button primary" type="button" @click="start">
                <span class="icon play" />
                <span>Starten</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Spinner, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Category, Product, ProductDateRange, ProductType, WebshopTicketType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { WebshopManager } from "../WebshopManager";
import TicketScannerView from "./TicketScannerView.vue";


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
export default class TicketScannerSetupView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        webshopManager!: WebshopManager

    disabledProducts: Product[] = []
    isChecking = true
    noDatabaseSupport = false

    created() {
        this.webshopManager.loadWebshopIfNeeded().then(() => {
            // Load disabled products in database
            this.webshopManager.readSettingKey("disabledProducts").then(value => {
                if (value && Array.isArray(value)) {
                    if (this.ticketProducts) {
                        this.disabledProducts = this.ticketProducts?.filter(p => value.includes(p.id))
                    }
                }
            }).catch(console.error)
        }).catch(console.error)

        // Initialize offlien storage: check if everything works okay
        this.isChecking = true
        this.webshopManager.getDatabase().catch(e => {
            this.noDatabaseSupport = true
        }).finally(() => {
            this.isChecking = false
        })
    }

    mounted() {
        // Set url
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshopManager.preview.meta.name)+"/tickets/setup")
        document.title = this.webshopManager.preview.meta.name+" - Tickets scannen"
    }

    formatDateRange(dateRange: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(dateRange.toString())
    }

    get isLoading() {
        return this.webshopManager.webshop === null
    }

    /**
     * Only filter if we sell tickets as products, not for tickets per order
     */
    get shouldFilter() {
        return this.webshopManager.preview.meta.ticketType === WebshopTicketType.Tickets
    }

    get ticketProducts() {
        return this.webshopManager.webshop?.products.filter(p => p.type === ProductType.Ticket || p.type === ProductType.Voucher) ?? []
    }

    get categories() {
        const categories = this.webshopManager.webshop?.categories.filter(c => this.getCategoryProducts(c).length > 0) ?? []
        if (categories.length <= 0) {
            return [
                Category.create({
                    name: '',
                    productIds: this.ticketProducts.map(p => p.id)
                })
            ]
        }
        return categories;
    }

    getCategoryProducts(category: Category) {
        return category.productIds.flatMap(p => {
            const product = this.ticketProducts.find(pp => pp.id === p)
            if (product) {
                return [product]
            }
            return []
        })
    }

    isProductSelected(product: Product) {
        return !this.disabledProducts.find(p => p.id === product.id)
    }

    setProductSelected(product: Product, selected: boolean) {
        if (selected === this.isProductSelected(product)) {
            return
        }
        if (selected) {
            this.disabledProducts = this.disabledProducts.filter(p => p.id !== product.id)
        } else {
            this.disabledProducts.push(product)
        }
    }

    start() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(TicketScannerView, { 
                webshopManager: this.webshopManager,
                disabledProducts: this.disabledProducts
            })
        }))

        // Save disabled products in database
        this.webshopManager.storeSettingKey("disabledProducts", this.disabledProducts.map(p => p.id)).catch(console.error)
    }
}
</script>

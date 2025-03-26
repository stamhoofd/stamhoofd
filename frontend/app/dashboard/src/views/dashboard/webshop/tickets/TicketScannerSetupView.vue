<template>
    <div class="st-view">
        <STNavigationBar title="Tickets scannen" />

        <main>
            <h1>
                Tickets scannen
            </h1>

            <Spinner v-if="(isLoading && shouldFilter) || isChecking" />
            <p v-else-if="shouldFilter && !isLoading && (ticketProducts.length > 1 || disabledProducts.length)">
                Vink hieronder de tickets aan die je wilt scannen en klik op "starten". Zo scan je niet per ongeluk een ongeldig ticket als je verschillende scanpunten hebt op je evenement (bv. drankkaarten en inkomtickets apart).
            </p>
            <p v-else>
                Klik op "starten" om te beginnen.
            </p>

            <p v-if="noDatabaseSupport" class="error-box">
                Dit appartaat ondersteunt de scanner niet. Probeer in een moderne browser, op een smartphone en zorg ervoor dat je niet in privé modus surft (dat voorkomt de noodzakelijk opslag van tickets als het internet wegvalt).
            </p>

            <a v-if="STAMHOOFD.platformName === 'stamhoofd'" class="info-box icon download selectable" href="https://files.stamhoofd.be/website/docs/tickets-checklist.pdf" download="tickets-checklist.pdf" target="_blank">
                Download de checklist voor het scannen van tickets
            </a>
            <a v-else class="info-box icon download selectable" href="https://files.stamhoofd.be/website/docs/tickets-checklist-whitelabel.pdf" download="tickets-checklist.pdf" target="_blank">
                Download de checklist voor het scannen van tickets
            </a>

            <template v-if="shouldFilter && !isLoading && (ticketProducts.length > 1 || disabledProducts.length)">
                <div v-for="category of categories" :key="category.id" class="container">
                    <hr v-if="categories.length > 1">
                    <h2 v-if="categories.length > 1">
                        {{ category.name }}
                    </h2>
                    <STList>
                        <STListItem v-for="product in getCategoryProducts(category)" :key="product.id" :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox :model-value="isProductSelected(product)" @update:model-value="setProductSelected(product, $event)" />
                            </template>

                            <h3 class="style-title-list">
                                {{ product.name }}
                            </h3>
                            <p v-if="(product.type === 'Ticket' || product.type === 'Voucher') && product.location" class="style-description-small" v-text="product.location.name" />
                            <p v-if="(product.type === 'Ticket' || product.type === 'Voucher') && product.dateRange" class="style-description-small" v-text="formatDateRange(product.dateRange)" />
                        </STListItem>
                    </STList>
                </div>
            </template>
        </main>

        <STToolbar v-if="!noDatabaseSupport">
            <template #right>
                <button class="button primary" type="button" @click="start">
                    <span class="icon play" />
                    <span>Starten</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { Checkbox, Spinner, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Category, Product, ProductDateRange, ProductType, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { computed, ref } from 'vue';
import { WebshopManager } from '../WebshopManager';
import TicketScannerView from './TicketScannerView.vue';

const props = defineProps<{
    webshopManager: WebshopManager;

}>();

const present = usePresent();
const disabledProducts = ref<Product[]>([]);
const isChecking = ref(false);
const noDatabaseSupport = ref(false);

function created() {
    props.webshopManager.loadWebshopIfNeeded().then(() => {
        // Load disabled products in database
        props.webshopManager.readSettingKey('disabledProducts').then((value) => {
            if (value && Array.isArray(value)) {
                if (ticketProducts.value) {
                    disabledProducts.value = ticketProducts.value?.filter(p => value.includes(p.id));
                }
            }
        }).catch(console.error);
    }).catch(console.error);

    // Initialize offlien storage: check if everything works okay
    isChecking.value = true;
    props.webshopManager.getDatabase().catch(() => {
        noDatabaseSupport.value = true;
    }).finally(() => {
        isChecking.value = false;
    });
}

created();

function formatDateRange(dateRange: ProductDateRange) {
    return Formatter.capitalizeFirstLetter(dateRange.toString());
}

const isLoading = computed(() => props.webshopManager.webshop === null);

// Only filter if we sell tickets as products, not for tickets per order
const shouldFilter = computed(() => props.webshopManager.preview.meta.ticketType === WebshopTicketType.Tickets);

const ticketProducts = computed(() => {
    return props.webshopManager.webshop?.products.filter(p => p.type === ProductType.Ticket || p.type === ProductType.Voucher) ?? [];
});

const categories = computed(() => {
    const categories = props.webshopManager.webshop?.categories.filter(c => getCategoryProducts(c).length > 0) ?? [];
    if (categories.length <= 0) {
        return [
            Category.create({
                name: '',
                productIds: ticketProducts.value.map(p => p.id),
            }),
        ];
    }
    return categories;
});

function getCategoryProducts(category: Category) {
    return category.productIds.flatMap((p) => {
        const product = ticketProducts.value.find(pp => pp.id === p);
        if (product) {
            return [product];
        }
        return [];
    });
}

function isProductSelected(product: Product) {
    return !disabledProducts.value.find(p => p.id === product.id);
}

function setProductSelected(product: Product, selected: boolean) {
    if (selected === isProductSelected(product)) {
        return;
    }
    if (selected) {
        disabledProducts.value = disabledProducts.value.filter(p => p.id !== product.id);
    }
    else {
        disabledProducts.value.push(product);
    }
}

function start() {
    present(new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(TicketScannerView, {
            webshopManager: props.webshopManager,
            disabledProducts: disabledProducts.value,
        }),
    })).catch(console.error);

    // Save disabled products in database
    props.webshopManager.storeSettingKey('disabledProducts', disabledProducts.value.map(p => p.id)).catch(console.error);
}
</script>

<template>
    <div class="container">
        <h2>{{ $t('Deelnemersgegevens') }}</h2>

        <STList :key="radioRenderKey">
            <STListItem :selectable="true" element-name="label" data-testid="participant-mode-order">
                <template #left>
                    <Radio :model-value="mode" value="order" name="participant-mode" @update:model-value="selectPerOrder" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('Eén keer per bestelling') }}
                </h3>
                <p class="style-description-small">
                    {{ isRegistrations ? $t('De besteller vult zijn gegevens één keer in, hoeveel inschrijvingen er ook besteld worden.') : $t('De besteller vult zijn gegevens één keer in, hoeveel tickets er ook besteld worden. Bv. een eetfestijn: 5× vlees en 1× veggie op één naam.') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" data-testid="participant-mode-item">
                <template #left>
                    <Radio :model-value="mode" value="item" name="participant-mode" @update:model-value="selectPerItem" />
                </template>
                <h3 class="style-title-list">
                    {{ isRegistrations ? $t('Per inschrijving') : $t('Per ticket') }}
                </h3>
                <p class="style-description-small">
                    {{ isRegistrations ? $t('Voor elke inschrijving vul je de gegevens van een deelnemer in. Bv. een kamp.') : $t('Voor elk ticket vul je de gegevens van een deelnemer in. Bv. een kamp of tickets op naam.') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="mode === 'item'" class="participant-products">
            <p v-if="!products.some(p => p.enableCustomer)" class="warning-box">
                {{ isRegistrations ? $t('Vink aan voor welke inschrijvingen je de gegevens van een deelnemer wil vragen.') : $t('Vink aan voor welke tickets je de gegevens van een deelnemer wil vragen.') }}
            </p>

            <STCard>
                <STList>
                    <STListItem v-for="product of products" :key="product.id" :selectable="true" class="right-stack left-center" data-testid="participant-product" @click="product.enableCustomer ? editProduct(product) : setEnabled(product, true)">
                        <template #left>
                            <Checkbox :model-value="product.enableCustomer" @update:model-value="setEnabled(product, $event)" @click.stop />
                        </template>
                        <h3 class="style-title-list">
                            {{ product.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ getSummary(product) }}
                        </p>
                        <template v-if="product.enableCustomer" #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </STCard>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@common/encoding';
import { PatchableArray } from '@common/encoding';
import { usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STCard from '@stamhoofd/components/layout/STCard.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { PrivateWebshop, Product, ProductType } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { getCustomerFields } from './customerFields';

/**
 * Chooses between collecting participant details once per order (the customer) or per ticket (`Product.enableCustomer`).
 * The choice is not stored itself: it follows from the products.
 */
const props = defineProps<{
    webshop: PrivateWebshop;
    /**
     * The saved webshop: questions that exist there may already have answers
     */
    originalWebshop: PrivateWebshop;
}>();

const emit = defineEmits<{
    patch: [patch: AutoEncoderPatchType<PrivateWebshop>];
}>();

const present = usePresent();
const products = computed(() => props.webshop.products);
const isRegistrations = computed(() => props.webshop.meta.isRegistrations);

// Local, so 'per ticket' stays selected while no ticket is checked yet
const mode = ref<'order' | 'item'>(props.webshop.products.some(p => p.enableCustomer) ? 'item' : 'order');

// The browser already unchecked the other radio when the switch is cancelled: rendering the radios again restores them
const radioRenderKey = ref(0);

// Settings of the tickets before switching to 'once per order': restored when switching back before saving
let previousSettings: Map<string, CustomerSettings | null> | null = null;

const fields = getCustomerFields();

function getSummary(product: Product) {
    if (!product.enableCustomer) {
        return $t('Geen gegevens per deelnemer');
    }
    const settings = product.resolvedCustomerSettings;
    const names = fields.filter(field => settings[field.key] !== CustomerFieldRequirement.Disabled).map(field => field.name);
    names.push(...(settings.recordCategory?.getAllRecords().map(record => record.name.toString()) ?? []));
    return names.join(' · ');
}

/**
 * Products sold per person are suggested; when there are none, every product
 */
function getSuggestedProducts() {
    const perPerson = products.value.filter(p => p.type === ProductType.Person || p.type === ProductType.Ticket);
    return perPerson.length > 0 ? perPerson : products.value;
}

function patchProducts(productPatches: AutoEncoderPatchType<Product>[]) {
    if (productPatches.length === 0) {
        return;
    }
    const array = new PatchableArray() as PatchableArrayAutoEncoder<Product>;
    for (const productPatch of productPatches) {
        array.addPatch(productPatch);
    }
    emit('patch', PrivateWebshop.patch({ products: array }));
}

function setEnabled(product: Product, enableCustomer: boolean) {
    patchProducts([Product.patch({ id: product.id, enableCustomer })]);
}

function selectPerItem() {
    mode.value = 'item';
    const restore = previousSettings;
    previousSettings = null;

    if (restore) {
        patchProducts(products.value.filter(p => restore.has(p.id)).map(p => Product.patch({
            id: p.id,
            enableCustomer: true,
            customerSettings: restore.get(p.id) ?? null,
        })));
        return;
    }
    patchProducts(getSuggestedProducts().filter(p => !p.enableCustomer).map(p => Product.patch({ id: p.id, enableCustomer: true })));
}

/**
 * Whether switching to 'once per order' loses anything beyond the default (only the name)
 */
function hasCustomSettings(product: Product) {
    const settings = product.customerSettings;
    if (!settings) {
        return false;
    }
    return !!settings.recordCategory || fields.some(field => field.key !== 'name' && settings[field.key] !== CustomerFieldRequirement.Disabled);
}

async function selectPerOrder() {
    const enabled = products.value.filter(p => p.enableCustomer);
    if (enabled.some(p => hasCustomSettings(p))) {
        const names = Formatter.joinLast(enabled.map(p => p.name), ', ', ' en ');
        const description = isRegistrations.value
            ? $t('{products} vragen dan geen gegevens per deelnemer meer. De gegevens en vragen die je per inschrijving instelde, worden verwijderd.', { products: names })
            : $t('{products} vragen dan geen gegevens per deelnemer meer. De gegevens en vragen die je per ticket instelde, worden verwijderd.', { products: names });
        if (!await CenteredMessage.confirm($t('Gegevens per deelnemer verwijderen?'), $t('%CJ'), description)) {
            radioRenderKey.value++;
            return;
        }
    }

    previousSettings = new Map(enabled.map(p => [p.id, p.customerSettings]));
    mode.value = 'order';
    patchProducts(enabled.map(p => Product.patch({ id: p.id, enableCustomer: false, customerSettings: null })));
}

async function editProduct(product: Product) {
    await present({
        components: [
            AsyncComponent(() => import('./products/EditProductCustomerSettingsView.vue'), {
                product,
                savedRecordIds: new Set(props.originalWebshop.products.find(p => p.id === product.id)?.customerSettings?.recordCategory?.getAllRecords().map(r => r.id) ?? []),
                saveHandler: (productPatch: AutoEncoderPatchType<Product>) => {
                    patchProducts([productPatch]);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>

<style lang="scss" scoped>
// Belongs to the 'per ticket' option above it
.participant-products {
    padding-left: 33px;
}
</style>

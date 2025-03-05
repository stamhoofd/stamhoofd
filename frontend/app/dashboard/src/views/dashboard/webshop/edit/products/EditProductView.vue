<template>
    <SaveView :title="isNew ? typeName+' ' + $t(`toevoegen`) : name+' ' + $t(`bewerken`)" :disabled="!hasChanges" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ typeName }} {{ $t('9523b774-a33e-40f8-900d-923f4aaa71db') }}
        </h1>
        <h1 v-else>
            {{ name || typeName }} {{ $t('67c5998c-da2a-4c23-b089-86cc90f011e0') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <div class="split-inputs">
            <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
                <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`) + ' '+typeName" autocomplete="off" enterkeyhint="next"></STInputBox>
            <STInputBox v-if="isTicket" error-fields="type" :error-box="errors.errorBox" :title="$t(`b610d465-2901-4b54-97ae-dbeab72e4762`)">
                <Dropdown v-model="type">
                    <option value="Ticket">
                        {{ $t('57c98fd7-1432-4b03-99f7-452b6c95a7f1') }}
                    </option>
                    <option value="Voucher">
                        {{ $t('e21e14ae-e857-49f7-921d-b064ab3c826b') }}
                    </option>
                </Dropdown>
            </STInputBox>

            <STInputBox v-else error-fields="type" :error-box="errors.errorBox" :title="$t(`b610d465-2901-4b54-97ae-dbeab72e4762`)">
                <Dropdown v-model="type">
                    <option value="Product">
                        {{ $t('8a4ce329-d112-4a5c-b918-be7510c1120d') }}
                    </option>
                    <option value="Person">
                        {{ $t('23b76c2e-9167-4adc-8797-f6c9bb261b47') }}
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`31ac5f55-59bc-4c22-819d-8187bf02fb5c`)"/>
        </STInputBox>

        <template v-if="isTicket">
            <hr><h2>{{ $t('257a3fd5-bd2f-4430-b268-1c85e99db41a') }}</h2>
            <ProductSelectLocationInput v-model="location" :locations="allLocations" :validator="errors.validator" @modify="modifyLocation"/>

            <hr><h2>{{ $t('b9e08142-f34f-4bf1-8a6f-016477b415db') }}</h2>
            <ProductSelectDateRangeInput v-model="dateRange" :date-ranges="allDateRanges" :validator="errors.validator" @modify="modifyDateRange"/>
        </template>

        <hr><h2 class="style-with-button">
            <div>{{ $t('c550bae6-012f-44f1-963d-877319d34500') }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addProductPrice">
                    <span class="icon add"/>
                    <span>{{ $t('e9f3660d-ab54-4f29-8c3f-85c756ac2ce0') }}</span>
                </button>
            </div>
        </h2>
        <p>{{ $t("8e14f168-77ad-4f01-8316-1e6af8ab9777") }}</p>

        <ProductPriceBox v-if="patchedProduct.prices.length === 1" :product-price="patchedProduct.prices[0]" :product="patchedProduct" :error-box="errors.errorBox" @patch="addProductPatch($event)"/>

        <STList v-else v-model="draggablePrices" :draggable="true">
            <template #item="{item: price}">
                <ProductPriceRow :product-price="price" :product="patchedProduct" @patch="addProductPatch" @move-up="movePriceUp(price)" @move-down="movePriceDown(price)"/>
            </template>
        </STList>

        <OptionMenuSection v-for="optionMenu in patchedProduct.optionMenus" :key="optionMenu.id" :option-menu="optionMenu" :product="patchedProduct" @patch="addProductPatch"/>

        <template v-if="fields.length">
            <hr><h2 class="style-with-button">
                <div>{{ $t('6e218284-fd5c-49f0-862f-060ac8ddc731') }}</div>
                <div>
                    <button class="button icon add" type="button" @click="addField"/>
                </div>
            </h2>

            <p>{{ $t("277dee72-2f32-4bf2-835c-99f05125ce86") }}</p>

            <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch"/>
        </template>

        <hr><STList>
            <STListItem v-if="seatingPlan" :selectable="true" element-name="button" @click="chooseSeatingPlan">
                <template #left>
                    <span class="icon seat gray"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('72cec47d-ea5a-4e4f-a712-d80e51fde1db') }}
                </h3>

                <p class="style-description-small">
                    {{ seatingPlan.name }}
                </p>

                <template #right>
                    <span class="icon success primary"/>
                    <span class="icon arrow-right-small gray"/>
                </template>
            </STListItem>

            <STListItem :selectable="true" element-name="button" @click="addOptionMenu">
                <template #left>
                    <span class="icon add gray"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('430f54c5-a9be-4009-bdae-70fe34cad7fc') }}
                </h3>
                <p class="style-description-small">
                    {{ $t(`88023b41-1bf3-4aee-aa80-dc2052572d2e`) }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="button" @click="addField">
                <template #left>
                    <span class="icon add gray"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('752914e7-9cd0-444d-9729-0a889323a1dd') }}
                </h3>
                <p class="style-description-small">
                    {{ $t("18336649-a9a3-49a8-a332-1a0e3f8a35ab") }}
                </p>
            </STListItem>

            <STListItem v-if="isTicket && !seatingPlan" :selectable="true" element-name="button" @click="chooseSeatingPlan">
                <template #left>
                    <span class="icon seat gray"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('44040701-ed34-418d-b9d5-9e531abdd9a2') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('dd2707b6-99b7-4fbf-bfb6-632404087e6b') }}
                </p>
            </STListItem>

            <STListItem v-if="!image" :selectable="true" element-name="label" class="button">
                <template #left>
                    <span class="icon camera gray"/>
                </template>

                <UploadButton v-model="image" :resolutions="resolutions" element-name="div">
                    <h3 class="style-title-list">
                        {{ $t('542c7a86-e64b-4c08-a9f9-3b3db08876e1') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t("13e1bb77-35c0-457c-bd23-4ba75ae1f5bb") }}
                    </p>
                </UploadButton>
            </STListItem>
        </STList>

        <template v-if="image">
            <hr><h2 class="style-with-button">
                <div>{{ $t('dae08418-fb55-421d-b61d-491e4530fc71') }}</div>
                <div>
                    <button v-if="image" type="button" class="button text only-icon-smartphone" @click="image = null">
                        <span class="icon trash"/>
                        <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                    </button>
                    <UploadButton v-model="image" :text="image ? $t(`c01d3d4e-ad4e-45ec-abac-431462c194cf`) : $t(`3370bb72-2817-4096-83ce-318993436513`)" :resolutions="resolutions"/>
                </div>
            </h2>

            <div class="image-box">
                <img v-if="image" :src="imageSrc ?? undefined" class="image"></div>
        </template>

        <hr><h2>
            {{ $t('bdbaebf3-eae4-4736-959b-97b90f979a8d') }}
            <span v-if="remainingStock !== null" class="title-suffix">{{ $t('6e14c628-5de5-4e2f-891d-dcb6badaa80f') }} {{ remainingStock }} {{ $t('79828b21-b66f-4e18-bb1e-bb46ee12a8af') }}</span>
        </h2>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('2cc2832f-7415-404c-9baf-b91ae0da4a77') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('50b5913a-eef7-445a-aefb-24b5e5d17cc8') }}
                </p>
            </STListItem>

            <template v-if="!hidden">
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="disabled"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('b189bb90-5982-48e6-a752-bb673d261bad') }}
                    </h3>
                    <p v-if="disabled" class="style-description-small">
                        {{ $t('43d513ae-2553-451f-a327-a1f72ca9938f') }}
                    </p>
                </STListItem>

                <template v-if="!disabled">
                    <STListItem :selectable="true" :element-name="useEnableAfter ? 'div' : 'label'">
                        <template #left>
                            <Checkbox v-model="useEnableAfter"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('3eb0782d-6822-48a3-b5f1-9c45a72278bb') }}
                        </h3>
                        <p v-if="useEnableAfter" class="style-description-small">
                            {{ $t('cd1553b9-55fb-4d9b-8ce4-ae05caf5157c') }}
                        </p>

                        <div v-if="useEnableAfter" class="split-inputs option">
                            <STInputBox title="" error-fields="enableAfter" :error-box="errors.errorBox">
                                <DateSelection v-model="enableAfter"/>
                            </STInputBox>
                            <TimeInput v-model="enableAfter" title="" :validator="errors.validator"/>
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" :element-name="useDisableAfter ? 'div' : 'label'">
                        <template #left>
                            <Checkbox v-model="useDisableAfter"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('771ae599-9b27-424c-91ae-d6982db69f69') }}
                        </h3>
                        <p v-if="useDisableAfter" class="style-description-small">
                            {{ $t('7620319e-af6c-4834-88f1-de1a677f1828') }}
                        </p>

                        <div v-if="useDisableAfter" class="split-inputs option">
                            <STInputBox title="" error-fields="disableAfter" :error-box="errors.errorBox">
                                <DateSelection v-model="disableAfter"/>
                            </STInputBox>
                            <TimeInput v-model="disableAfter" title="" :validator="errors.validator"/>
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useStock"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('083ceff7-ae68-4bd8-871a-6e4002991513') }} {{ usedStock }} {{ $t('e284d77b-c88c-4c0f-8464-58c4fe12eda8') }}
                        </h3>

                        <p v-if="useStock" class="style-description-small">
                            {{ $t('7ce15ac4-bde4-4893-8db7-e0d0ab030c79') }}
                        </p>

                        <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                                <NumberInput v-model="stock"/>
                            </STInputBox>
                        </div>
                    </STListItem>

                    <STListItem v-if="false && useStock" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="resetStock"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('ee593d68-4ee8-4bb8-a2ba-d606b8ec75d6') }} {{ usedStock }} {{ $t('0eb5e141-967d-477f-abf2-11d33ad6cc0b') }}
                        </h3>

                        <div v-if="resetStock" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="usedStock" :error-box="errors.errorBox">
                                <NumberInput v-model="usedStock"/>
                            </STInputBox>
                        </div>

                        <p class="style-description">
                            {{ $t('7ce15ac4-bde4-4893-8db7-e0d0ab030c79') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useMaxPerOrder"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('4c1a14d8-0ce1-4a43-b9e4-09a2c156fd94') }}
                        </h3>

                        <p v-if="useMaxPerOrder" class="style-description-small">
                            {{ $t('0ae7af1e-ae90-4c99-9a6c-b05f6cd5528a') }}
                        </p>

                        <div v-if="useMaxPerOrder" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="maxPerOrder" :error-box="errors.errorBox">
                                <NumberInput v-model="maxPerOrder" :min="1"/>
                            </STInputBox>
                        </div>
                    </STListItem>
                </template>
            </template>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="notAllowMultiple"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('a51c2430-4f65-4ff3-a62d-c2fce085ea43') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('6774b7bd-2f17-4f36-b1a2-0b417537bb1f') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('01e546e1-a416-4843-8f4b-06effbeaef57') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, Decoder, ObjectData, PatchableArray, PatchableArrayAutoEncoder, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, DateSelection, Dropdown, NumberInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Toast, UploadButton, useErrors, usePatch } from '@stamhoofd/components';
import { Image, OptionMenu, PrivateWebshop, Product, ProductDateRange, ProductLocation, ProductPrice, ProductType, ResolutionRequest, Version, WebshopField, WebshopTicketType } from '@stamhoofd/structures';

import { computed, onBeforeUnmount, onMounted } from 'vue';
import EditWebshopFieldView from '../fields/EditWebshopFieldView.vue';
import WebshopFieldsBox from '../fields/WebshopFieldsBox.vue';
import ChooseSeatingPlanView from '../seating/ChooseSeatingPlanView.vue';
import EditOptionMenuView from './EditOptionMenuView.vue';
import EditProductPriceView from './EditProductPriceView.vue';
import OptionMenuSection from './OptionMenuSection.vue';
import ProductPriceBox from './ProductPriceBox.vue';
import ProductPriceRow from './ProductPriceRow.vue';
import ProductSelectDateRangeInput from './ProductSelectDateRangeInput.vue';
import ProductSelectLocationInput from './ProductSelectLocationInput.vue';

const props = defineProps<{
    product: Product;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;
}>();

const errors = useErrors();
const present = usePresent();
const pop = usePop();

/// For now only used to update locations and times of other products that are shared
const { patch: patchWebshop, patched: patchedWebshop, addPatch: addWebshopPatch, hasChanges: hasWebshopChanges } = usePatch(props.webshop);
const { patch: patchProduct, patched: patchedProduct, addPatch: addProductPatch, hasChanges: hasProductChanges } = usePatch(props.product);

onMounted(() => {
    document.body.addEventListener('paste', onPastEventListener);
});

onBeforeUnmount(() => {
    document.body.removeEventListener('paste', onPastEventListener);
});

function onPastEventListener(event: Event) {
    onPaste(event).catch(console.error);
}

async function onPaste(event: Event) {
    console.log('Pasted data');

    try {
        // Iterate over all clipboard items.
        const clipboardItems = await navigator.clipboard.read();
        for (const clipboardItem of clipboardItems) {
            for (const type of clipboardItem.types) {
                // Discard any types that are not web custom formats.
                if (type === 'web stamhoofd/webshop-option-menu') {
                    const blob = await clipboardItem.getType(type);
                    const str = await blob.text();

                    const decoded = new VersionBoxDecoder(OptionMenu as Decoder<OptionMenu>).decode(new ObjectData(JSON.parse(str), { version: Version }));
                    console.log('pasted option menu', decoded);

                    // Create a new id
                    decoded.data.id = OptionMenu.create({}).id;
                    const p = Product.patch({ id: props.product.id });
                    p.optionMenus.addPut(decoded.data);
                    addProductPatch(p);

                    new Toast(`Keuzemenu ${decoded.data.name || 'Naamloos'} werd geplakt vanaf je klembord`, 'copy').show();

                    event.preventDefault();
                }

                // Sanitize the blob if you need to, then process it in your app.
            }
        }
    }
    catch (err: any) {
        console.error(err.name, err.message);
    }
}

const isTicket = computed(() => type.value === ProductType.Ticket || type.value === ProductType.Voucher || props.webshop.meta.ticketType === WebshopTicketType.Tickets);

const seatingPlan = computed(() => {
    if (!patchedProduct.value.seatingPlanId) {
        return null;
    }
    return patchedWebshop.value.meta.seatingPlans.find(p => p.id === patchedProduct.value.seatingPlanId) ?? null;
});

const typeName = computed(() => {
    switch (props.product.type) {
        case ProductType.Product:
        case ProductType.Person:
            return 'Artikel';
        case ProductType.Ticket: return 'Ticket';
        case ProductType.Voucher: return 'Voucher';
        default: return '?';
    }
});

const fields = computed(() => patchedProduct.value.customFields);

function addFieldsPatch(patch: PatchableArrayAutoEncoder<WebshopField>) {
    addProductPatch(Product.patch({
        customFields: patch,
    }));
}

function chooseSeatingPlan() {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ChooseSeatingPlanView, {
                    product: patchedProduct.value,
                    webshop: patchedWebshop.value,
                    saveHandler: (patchProduct: AutoEncoderPatchType<PrivateWebshop>, patch: AutoEncoderPatchType<PrivateWebshop>) => {
                        addProductPatch(patchProduct);
                        addWebshopPatch(patch);
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

const name = computed({
    get: () => patchedProduct.value.name,
    set: (name: string) => {
        addProductPatch({ name });
    },
});

const location = computed({
    get: () => patchedProduct.value.location,
    set: (location: ProductLocation | null) => {
        addProductPatch({ location });
    },
});

const allLocations = computed(() => {
    const locations = new Map<string, ProductLocation>();

    // Always use the non-patched product here -> only list the locations as they are before starting the editing
    // But do use the patched webshop, because that is where we modify the locations in case of edits
    for (const product of patchedWebshop.value.products) {
        if (product.location) {
            locations.set(product.location.id, product.location);
        }
    }
    return [...locations.values()];
});

function modifyLocation({ from, to }: { from: ProductLocation; to: ProductLocation }) {
    // We edited/modified a location, so change it in all products
    for (const product of patchedWebshop.value.products) {
        if (product.location && product.location.id === from.id) {
            patchWebshop.value.products.addPatch(Product.patch({
                id: product.id,
                location: to,
            }));
        }
    }
}

const dateRange = computed({
    get: () => patchedProduct.value.dateRange,
    set: (dateRange: ProductDateRange | null) => {
        addProductPatch({ dateRange });
    },
});

const allDateRanges = computed(() => {
    const dateRanges = new Map<string, ProductDateRange>();

    // Always use the non-patched product here -> only list the locations as they are before starting the editing
    // But do use the patched webshop, because that is where we modify the locations in case of edits
    for (const product of patchedWebshop.value.products) {
        if (product.dateRange) {
            dateRanges.set(product.dateRange.id, product.dateRange);
        }
    }
    return [...dateRanges.values()];
});

function modifyDateRange({ from, to }: { from: ProductDateRange; to: ProductDateRange }) {
    // We edited/modified a location, so change it in all products
    for (const product of patchedWebshop.value.products) {
        if (product.dateRange && product.dateRange.id === from.id) {
            patchWebshop.value.products.addPatch(Product.patch({
                id: product.id,
                dateRange: to,
            }));
        }
    }
}

const type = computed({
    get: () => patchedProduct.value.type,
    set: (type: ProductType) => {
        addProductPatch({ type });
    },
});

const description = computed({
    get: () => patchedProduct.value.description,
    set: (description: string) => {
        addProductPatch({ description });
    },
});

const disabled = computed({
    get: () => !patchedProduct.value.enabled,
    set: (disabled: boolean) => {
        addProductPatch({ enabled: !disabled });
    },
});

const hidden = computed({
    get: () => patchedProduct.value.hidden,
    set: (hidden: boolean) => {
        addProductPatch({ hidden });
    },
});

const useDisableAfter = computed({
    get: () => patchedProduct.value.disableAfter !== null,
    set: (use: boolean) => {
        if (use === useDisableAfter.value) {
            return;
        }
        if (use) {
            addProductPatch({ disableAfter: patchedProduct.value.disableAfter ?? props.product.disableAfter ?? new Date() });
        }
        else {
            addProductPatch({ disableAfter: null });
        }
    },
});

const disableAfter = computed({
    get: () => patchedProduct.value.disableAfter ?? props.product.disableAfter ?? new Date(),
    set: (disableAfter: Date) => {
        addProductPatch({ disableAfter });
    },
});

const useEnableAfter = computed({
    get: () => patchedProduct.value.enableAfter !== null,
    set: (use: boolean) => {
        if (use === useEnableAfter.value) {
            return;
        }
        if (use) {
            addProductPatch({ enableAfter: patchedProduct.value.enableAfter ?? props.product.enableAfter ?? new Date() });
        }
        else {
            addProductPatch({ enableAfter: null });
        }
    },
});

const enableAfter = computed({
    get: () => patchedProduct.value.enableAfter ?? props.product.enableAfter ?? new Date(),
    set: (enableAfter: Date) => {
        addProductPatch({ enableAfter });
    },
});

const notAllowMultiple = computed({
    get: () => !patchedProduct.value.allowMultiple,
    set: (notAllowMultiple: boolean) => {
        addProductPatch({ allowMultiple: !notAllowMultiple });
    },
});

const remainingStock = computed(() => patchedProduct.value.remainingStock);

const useStock = computed({
    get: () => patchedProduct.value.stock !== null,
    set: (useStock: boolean) => {
        addProductPatch({ stock: useStock ? (patchedProduct.value.stock ?? props.product.stock ?? (props.product.usedStock || 10)) : null });
    },
});

const stock = computed({
    get: () => patchedProduct.value.stock ?? props.product.stock ?? 0,
    set: (stock: number) => {
        addProductPatch({ stock });
    },
});

const useMaxPerOrder = computed({
    get: () => patchedProduct.value.maxPerOrder !== null,
    set: (useMaxPerOrder: boolean) => {
        addProductPatch({ maxPerOrder: useMaxPerOrder ? (patchedProduct.value.maxPerOrder ?? props.product.maxPerOrder ?? 1) : null });
    },
});

const maxPerOrder = computed({
    get: () => patchedProduct.value.maxPerOrder ?? 1,
    set: (maxPerOrder: number) => {
        addProductPatch({ maxPerOrder });
    },
});

const resetStock = computed({
    get: () => patchProduct.value.usedStock !== undefined,
    set: (value: boolean) => {
        if (value === resetStock.value) {
            return;
        }
        if (value) {
            usedStockPatch.value = usedStock.value;
        }
        else {
            usedStockPatch.value = null;
        }
    },
});

const usedStockPatch = computed({
    get: () => patchProduct.value.usedStock ?? null,
    set: (value: null | number) => {
        if (value === null) {
            patchProduct.value.usedStock = undefined;
            return;
        }
        usedStock.value = value;
    },
});

const usedStock = computed({
    get: () => patchedProduct.value.usedStock,
    set: (usedStock: number) => {
        addProductPatch({ usedStock });
    },
});

const resolutions = computed(() => [
    ResolutionRequest.create({
        width: 1200,
    }),
    ResolutionRequest.create({
        width: 600,
    }),
    ResolutionRequest.create({
        width: 300,
    }),
    ResolutionRequest.create({
        width: 100,
    }),
]);

const image = computed<Image | null>({
    get: () => patchedProduct.value.images[0] ?? null,
    set: (image: Image | null) => {
        const p = Product.patch({ });

        for (const i of patchedProduct.value.images) {
            p.images.addDelete(i.id);
        }

        if (image) {
            p.images.addPut(image);
        }

        addProductPatch(p);
    },
});

const imageSrc = computed(() => {
    if (!image.value) {
        return null;
    }
    return image.value.getPathForSize(140, undefined);
});

function addOptionMenu() {
    const optionMenu = OptionMenu.create({
        name: 'Naamloos',
    });
    optionMenu.options[0].name = 'Naamloos';

    const p = Product.patch({ id: props.product.id });
    p.optionMenus.addPut(optionMenu);

    present(new ComponentWithProperties(EditOptionMenuView,
        {
            product: patchedProduct.value.patch(p),
            optionMenu,
            isNew: true,
            saveHandler: (patch: AutoEncoderPatchType<Product>) => {
                // Merge both patches
                addProductPatch(p.patch(patch));
                // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
            },
        }).setDisplayStyle('popup'))
        .catch(console.error);
}

function addField() {
    const field = WebshopField.create({});
    const p: PatchableArrayAutoEncoder<WebshopField> = new PatchableArray();

    p.addPut(field);

    present(
        new ComponentWithProperties(EditWebshopFieldView, {
            field,
            isNew: true,
            saveHandler: (patch: PatchableArrayAutoEncoder<WebshopField>) => {
                addFieldsPatch(p.patch(patch));
            },
        }).setDisplayStyle('sheet'),
    ).catch(console.error);
}

function addProductPrice() {
    const price = ProductPrice.create({});
    const p = Product.patch({ id: props.product.id });
    p.prices.addPut(price);

    present(new ComponentWithProperties(EditProductPriceView, { product: patchedProduct.value.patch(p), productPrice: price, isNew: true, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
        // Merge both patches
        addProductPatch(p.patch(patch));

        // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
    } }).setDisplayStyle('popup'))
        .catch(console.error);
}

function movePriceUp(price: ProductPrice) {
    const index = patchedProduct.value.prices.findIndex(c => price.id === c.id);
    if (index === -1 || index === 0) {
        return;
    }

    const moveTo = index - 2;
    const p = Product.patch({});
    p.prices.addMove(price.id, patchedProduct.value.prices[moveTo]?.id ?? null);
    addProductPatch(p);
}

function movePriceDown(price: ProductPrice) {
    const index = patchedProduct.value.prices.findIndex(c => price.id === c.id);
    if (index === -1 || index >= patchedProduct.value.prices.length - 1) {
        return;
    }

    const moveTo = index + 1;
    const p = Product.patch({});
    p.prices.addMove(price.id, patchedProduct.value.prices[moveTo].id);
    addProductPatch(p);
}

const draggablePrices = computed({
    get: () => patchedProduct.value.prices,
    set: (prices: ProductPrice[]) => {
        if (prices.length !== patchedProduct.value.prices.length) {
            return;
        }

        const p = Product.patch({});
        for (const price of prices.slice().reverse()) {
            p.prices.addMove(price.id, null);
        }
        addProductPatch(p);
    },
});

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }
    const p = PrivateWebshop.patch(patchWebshop.value);
    p.products.addPatch(patchProduct.value);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je dit artikel wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p = PrivateWebshop.patch({});
    p.products.addDelete(props.product.id);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

const hasChanges = computed(() => hasWebshopChanges.value || hasProductChanges.value);

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({ shouldNavigateAway });
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.product-edit-view {
    .image-box {
        margin: 0 -5px;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        overflow: hidden;

        img.image {
            margin: 5px;
            max-height: 140px;
            max-width: 100%;
            border-radius: $border-radius;
            align-self: flex-start;
        }
    }

}
</style>

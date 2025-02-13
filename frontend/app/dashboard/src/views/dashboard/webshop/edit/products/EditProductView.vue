<template>
    <SaveView :title="isNew ? typeName+' toevoegen' : name+' bewerken'" :disabled="!hasChanges" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ typeName }} toevoegen
        </h1>
        <h1 v-else>
            {{ name || typeName }} bewerken
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    :placeholder="'Naam '+typeName"
                    autocomplete="off"
                    enterkeyhint="next"
                >
            </STInputBox>
            <STInputBox v-if="isTicket" title="Type" error-fields="type" :error-box="errors.errorBox">
                <Dropdown
                    v-model="type"
                >
                    <option value="Ticket">
                        Ticket
                    </option>
                    <option value="Voucher">
                        Voucher
                    </option>
                </Dropdown>
            </STInputBox>

            <STInputBox v-else title="Type" error-fields="type" :error-box="errors.errorBox">
                <Dropdown
                    v-model="type"
                >
                    <option value="Product">
                        Stuks
                    </option>
                    <option value="Person">
                        Personen
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <STInputBox title="Beschrijving" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Beschrijving van dit artikel"
                autocomplete="off"
                enterkeyhint="next"
            />
        </STInputBox>

        <template v-if="isTicket">
            <hr>
            <h2>Locatie</h2>
            <ProductSelectLocationInput v-model="location" :locations="allLocations" :validator="errors.validator" @modify="modifyLocation" />

            <hr>
            <h2>Datum en tijd</h2>
            <ProductSelectDateRangeInput v-model="dateRange" :date-ranges="allDateRanges" :validator="errors.validator" @modify="modifyDateRange" />
        </template>

        <hr>
        <h2 class="style-with-button">
            <div>Prijzen</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addProductPrice">
                    <span class="icon add" />
                    <span>Prijs</span>
                </button>
            </div>
        </h2>
        <p>Je kan een artikel meerdere prijzen geven en aan elke prijs een naam geven. Bv. small, medium en large. Naast meerdere prijzen kan je ook meerdere keuzemenu's toevoegen (zie onder).</p>

        <ProductPriceBox v-if="patchedProduct.prices.length === 1" :product-price="patchedProduct.prices[0]" :product="patchedProduct" :error-box="errors.errorBox" @patch="addProductPatch($event)" />

        <STList v-else v-model="draggablePrices" :draggable="true">
            <template #item="{item: price}">
                <ProductPriceRow :product-price="price" :product="patchedProduct" @patch="addProductPatch" @move-up="movePriceUp(price)" @move-down="movePriceDown(price)" />
            </template>
        </STList>

        <OptionMenuSection v-for="optionMenu in patchedProduct.optionMenus" :key="optionMenu.id" :option-menu="optionMenu" :product="patchedProduct" @patch="addProductPatch" />

        <template v-if="fields.length">
            <hr>
            <h2 class="style-with-button">
                <div>Tekstvelden / open vragen</div>
                <div>
                    <button class="button icon add" type="button" @click="addField" />
                </div>
            </h2>

            <p>Open vragen zijn vragen (bv. 'naam op de trui') waarbij bestellers zelf tekst kunnen intypen. Let op: voeg hier geen vragen toe die op bestelniveau moeten komen (want dan moet de gebruiker die meerdere keren beantwoorden), dat kan je doen in de instellingen van de webshop zelf.</p>

            <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />
        </template>

        <hr>

        <STList>
            <STListItem v-if="seatingPlan" :selectable="true" element-name="button" @click="chooseSeatingPlan">
                <template #left>
                    <span class="icon seat gray" />
                </template>
                <h3 class="style-title-list">
                    Zaalplan
                </h3>

                <p class="style-description-small">
                    {{ seatingPlan.name }}
                </p>

                <template #right>
                    <span class="icon success primary" />
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" element-name="button" @click="addOptionMenu">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    Keuzemenu
                </h3>
                <p class="style-description-small">
                    Laat bestellers een keuze maken uit een lijst met opties, al dan niet met een meerprijs. Bv. "Kies je extra's" met daarin bijvoorbeeld "Kaas op je spaghetti"
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="button" @click="addField">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    Tekstveld (open vraag)
                </h3>
                <p class="style-description-small">
                    Stel een open vraag (bv. 'naam op de trui') waarbij men zelf tekst kan intypen. Let op: voeg hier geen vragen toe die op bestelniveau moeten komen (want dan moet de gebruiker die meerdere keren beantwoorden), dat kan je doen in de instellingen van de webshop zelf.
                </p>
            </STListItem>

            <STListItem v-if="isTicket && !seatingPlan" :selectable="true" element-name="button" @click="chooseSeatingPlan">
                <template #left>
                    <span class="icon seat gray" />
                </template>
                <h3 class="style-title-list">
                    Zetelselectie instellen
                </h3>
                <p class="style-description-small">
                    Laat bestellers hun zetel kiezen bij het bestellen. Ideaal voor bijvoorbeeld een dansvoorstelling met vaste plaatsen.
                </p>
            </STListItem>

            <STListItem v-if="!image" :selectable="true" element-name="label" class="button">
                <template #left>
                    <span class="icon camera gray" />
                </template>

                <UploadButton v-model="image" :resolutions="resolutions" element-name="div">
                    <h3 class="style-title-list">
                        Foto toevoegen
                    </h3>
                    <p class="style-description-small">
                        Voeg een foto toe aan dit artikel. Knip bij voorkeur zelf je foto's wat bij zodat ze mooi weergegeven worden voor je ze uploadt.
                    </p>
                </UploadButton>
            </STListItem>
        </STList>

        <template v-if="image">
            <hr>
            <h2 class="style-with-button">
                <div>Foto</div>
                <div>
                    <button v-if="image" type="button" class="button text only-icon-smartphone" @click="image = null">
                        <span class="icon trash" />
                        <span>Verwijderen</span>
                    </button>
                    <UploadButton v-model="image" :text="image ? 'Vervangen' : 'Uploaden'" :resolutions="resolutions" />
                </div>
            </h2>

            <div class="image-box">
                <img v-if="image" :src="imageSrc ?? undefined" class="image">
            </div>
        </template>

        <hr>
        <h2>
            Beschikbaarheid
            <span v-if="remainingStock !== null" class="title-suffix">nog {{ remainingStock }} beschikbaar</span>
        </h2>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    Verbergen op webshop
                </h3>
                <p v-if="hidden" class="style-description-small">
                    Dit artikel wordt onzichtbaar op de webshop en is enkel te bestellen door manueel een bestelling in te geven als beheerder.
                </p>
            </STListItem>

            <template v-if="!hidden">
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="disabled" />
                    </template>

                    <h3 class="style-title-list">
                        Onbeschikbaar
                    </h3>
                    <p v-if="disabled" class="style-description-small">
                        Zichtbaar op de webshop, maar niet mogelijk om te bestellen.
                    </p>
                </STListItem>

                <template v-if="!disabled">
                    <STListItem :selectable="true" :element-name="useEnableAfter ? 'div' : 'label'">
                        <template #left>
                            <Checkbox v-model="useEnableAfter" />
                        </template>

                        <h3 class="style-title-list">
                            Beschikbaar vanaf datum
                        </h3>
                        <p v-if="useEnableAfter" class="style-description-small">
                            Zichtbaar op de webshop, maar pas te bestellen vanaf een bepaalde datum.
                        </p>

                        <div v-if="useEnableAfter" class="split-inputs option">
                            <STInputBox title="" error-fields="enableAfter" :error-box="errors.errorBox">
                                <DateSelection v-model="enableAfter" />
                            </STInputBox>
                            <TimeInput v-model="enableAfter" title="" :validator="errors.validator" />
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" :element-name="useDisableAfter ? 'div' : 'label'">
                        <template #left>
                            <Checkbox v-model="useDisableAfter" />
                        </template>

                        <h3 class="style-title-list">
                            Onbeschikbaar na datum
                        </h3>
                        <p v-if="useDisableAfter" class="style-description-small">
                            Zichtbaar op de webshop, maar niet meer te bestellen na een bepaalde datum.
                        </p>

                        <div v-if="useDisableAfter" class="split-inputs option">
                            <STInputBox title="" error-fields="disableAfter" :error-box="errors.errorBox">
                                <DateSelection v-model="disableAfter" />
                            </STInputBox>
                            <TimeInput v-model="disableAfter" title="" :validator="errors.validator" />
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useStock" />
                        </template>

                        <h3 class="style-title-list">
                            Beperk het beschikbare aantal stuks (waarvan nu {{ usedStock }} verkocht of gereserveerd)
                        </h3>

                        <p v-if="useStock" class="style-description-small">
                            Geannuleerde en verwijderde bestellingen worden niet meegerekend.
                        </p>

                        <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                                <NumberInput v-model="stock" />
                            </STInputBox>
                        </div>
                    </STListItem>

                    <STListItem v-if="false && useStock" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="resetStock" />
                        </template>

                        <h3 class="style-title-list">
                            Wijzig aantal verkochte stuks manueel (nu {{ usedStock }} verkocht)
                        </h3>

                        <div v-if="resetStock" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="usedStock" :error-box="errors.errorBox">
                                <NumberInput v-model="usedStock" />
                            </STInputBox>
                        </div>

                        <p class="style-description">
                            Geannuleerde en verwijderde bestellingen worden niet meegerekend.
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useMaxPerOrder" />
                        </template>

                        <h3 class="style-title-list">
                            Beperk het maximaal aantal stuks per bestelling
                        </h3>

                        <p v-if="useMaxPerOrder" class="style-description-small">
                            Het aantal stuks wordt geteld over alle mogelijke keuzes heen en wordt niet gecommuniceerd tenzij men over de limiet gaat.
                        </p>

                        <div v-if="useMaxPerOrder" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="maxPerOrder" :error-box="errors.errorBox">
                                <NumberInput v-model="maxPerOrder" :min="1" />
                            </STInputBox>
                        </div>
                    </STListItem>
                </template>
            </template>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="notAllowMultiple" />
                </template>

                <h3 class="style-title-list">
                    Keuze voor aantal stuks verbergen
                </h3>
                <p class="style-description-small">
                    Als je dit aanzet kan er maar één stuk besteld worden per unieke combinatie van keuzes en open vragen.
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder dit artikel
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
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

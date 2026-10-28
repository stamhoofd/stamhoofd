<template>
    <div class="edit-product-box container" :class="{ 'form-mode': formMode }">
        <p v-if="!nameWarning && seatingWarning" class="error-box">
            {{ seatingWarning }}
        </p>

        <button v-if="!patchedProduct.uitpasEvent && atLeastOneUitpasSocialTariff && uitpasFeature && organization.meta.uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok" type="button" class="warning-box with-button selectable" @click="openUitpasEventSearch()">
            {{ $t('%1Bx') }}

            <span class="button text" type="button">
                {{ $t('%1By') }}
            </span>
        </button>
        <button v-else-if="patchedProduct.uitpasEvent && atLeastOneUitpasSocialTariff && uitpasFeature && organization.meta.uitpasClientCredentialsStatus !== UitpasClientCredentialsStatus.Ok" type="button" class="error-box with-button selectable" @click="openUitpasSettings()">
            {{ UitpasClientCredentialsStatusHelper.getName(organization.meta.uitpasClientCredentialsStatus) }}

            <span class="button text" type="button">
                {{ $t('%1Bz') }}
            </span>
        </button>

        <p v-if="stepInfo" class="info-box" data-testid="single-form-step-info">
            {{ stepInfo }}
        </p>

        <div v-if="showName || showType" class="split-inputs">
            <STInputBox v-if="showName" error-fields="name" :error-box="errorBox" :title="$t(`%1Os`)">
                <!-- An older form can have its own name: the form takes the name of the webshop again -->
                <template v-if="formMode && name !== webshop.meta.name" #right>
                    <button v-tooltip="$t('Naam van webshop gebruiken')" type="button" class="button text only-icon-smartphone" data-testid="use-webshop-name-button" @click="name = webshop.meta.name">
                        <span class="icon undo" />
                        <span>{{ $t('Herstellen') }}</span>
                    </button>
                </template>
                <input ref="firstInput" v-model="name" v-autofocus="isNew" class="input" type="text" :placeholder="$t(`%1Os`) + ' '+typeName" autocomplete="off" enterkeyhint="next">
                <p v-if="nameWarning" class="warning-box">
                    {{ nameWarning }}
                </p>
            </STInputBox>
            <STInputBox v-if="showType && isTicket" error-fields="type" :error-box="errorBox" :title="$t(`%1B`)">
                <Dropdown v-model="type">
                    <option value="Ticket">
                        {{ $t('%2K') }}
                    </option>
                    <option value="Voucher">
                        {{ $t('%g') }}
                    </option>
                </Dropdown>
            </STInputBox>

            <STInputBox v-else-if="showType" error-fields="type" :error-box="errorBox" :title="$t(`%1B`)">
                <Dropdown v-model="type">
                    <option value="Product">
                        {{ $t('%TU') }}
                    </option>
                    <option value="Person">
                        {{ $t('%TV') }}
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <STInputBox v-if="showDescription" error-fields="description" :error-box="errorBox" class="max" :title="$t(`%6o`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`%U1`)" />
        </STInputBox>

        <template v-if="isTicket">
            <!-- Optional: added with the button below -->
            <template v-if="location">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ $t('%8a') }}</div>
                    <div>
                        <button class="button text only-icon-smartphone" type="button" data-testid="remove-location-button" @click="location = null">
                            <span class="icon trash" />
                            <span>{{ $t('%CJ') }}</span>
                        </button>
                    </div>
                </h2>
                <ProductLocationInput v-model="location" :validator="validator" />
            </template>

            <hr>
            <h2>{{ $t('%TX') }}</h2>
            <ProductDateRangeInput v-model="dateRange" :validator="validator" />
        </template>

        <template v-if="uitpasFeature && patchedProduct.uitpasEvent">
            <hr>
            <h2 class="style-with-button">
                <div>{{ $t('%1Bp') }}</div>
                `<button class="button text only-icon-smartphone" type="button" @click="clearUitpasEvent">
                    <span class="icon unlink" />
                    <span>{{ $t('%1C0') }}</span>
                </button>`
            </h2>
            <p class="style-description-small">
                {{ $t('%1C1') }}
            </p>

            <STList>
                <STListItem
                    :selectable="true"
                    @click="openUitpasEventSearch()"
                >
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/uitpas.svg">
                    </template>

                    <h3 class="style-title-list">
                        {{ patchedProduct.uitpasEvent.name }}
                    </h3>

                    <p class="style-description">
                        {{ patchedProduct.uitpasEvent.location }}
                    </p>

                    <template #right>
                        <span class="button text">
                            {{ $t('%1Bm') }}
                            <span class="icon arrow-right-small" />
                        </span>
                    </template>
                </STListItem>
            </STList>
        </template>

        <hr>
        <h2 class="style-with-button">
            <div>{{ $t('%61') }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addProductPrice()">
                    <span class="icon add" />
                    <span>{{ $t('%62') }}</span>
                </button>
            </div>
        </h2>
        <p v-if="!isTicket">
            {{ $t("%Zyu") }}
        </p>
        <p v-else>
            {{ $t("%ZyE") }}
        </p>

        <ProductPriceBox v-if="patchedProduct.prices.length === 1" :is-new="isNew" :product-price="patchedProduct.prices[0]" :product="patchedProduct" :error-box="errorBox" :validator="validator" @patch="addProductPatch($event)" />

        <STList v-else v-model="draggablePrices" :draggable="true">
            <template #item="{item: price}">
                <ProductPriceRow :product-price="price" :product="patchedProduct" @patch="addProductPatch" @move-up="movePriceUp(price)" @move-down="movePriceDown(price)" />
            </template>
        </STList>

        <OptionMenuSection v-for="optionMenu in patchedProduct.optionMenus" :key="optionMenu.id" :option-menu="optionMenu" :product="patchedProduct" @patch="addProductPatch" />

        <template v-if="fields.length">
            <hr>
            <h2 class="style-with-button">
                <div>{{ $t('%TZ') }}</div>
                <div>
                    <button class="button icon add" type="button" @click="addField" />
                </div>
            </h2>

            <p>{{ $t("%Ty") }}</p>

            <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />
        </template>

        <hr>
        <STList>
            <STListItem v-if="uitpasFeature && !patchedProduct.prices.some(p => p.uitpasBaseProductPriceId !== null) && uitpasBaseProductPriceAvailable" :selectable="true" element-name="button" @click="addProductPrice(true)">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%1AJ') }}
                </h3>
            </STListItem>

            <STListItem v-if="seatingPlan" :selectable="true" element-name="button" @click="chooseSeatingPlan">
                <template #left>
                    <span class="icon seat gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%Ta') }}
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
                    {{ $t('%Tb') }}
                </h3>
                <p class="style-description-small">
                    {{ $t(`%U2`) }}
                </p>
            </STListItem>

            <STListItem v-if="!formMode" :selectable="true" element-name="button" @click="addField">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%Tc') }}
                </h3>
                <p class="style-description-small">
                    {{ $t("%Tz") }}
                </p>
            </STListItem>

            <STListItem v-if="isTicket && !location" :selectable="true" element-name="button" data-testid="add-location-button" @click="addLocation">
                <template #left>
                    <span class="icon location gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%4S') }}
                </h3>
            </STListItem>

            <STListItem v-if="isTicket && !seatingPlan" :selectable="true" element-name="button" @click="chooseSeatingPlan">
                <template #left>
                    <span class="icon seat gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%Td') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%Te') }}
                </p>
            </STListItem>

            <STListItem v-if="!formMode && images.length === 0" :selectable="true" element-name="label" class="button">
                <template #left>
                    <span class="icon camera gray" />
                </template>

                <UploadButton v-model="newImage" :resolutions="resolutions" element-name="div">
                    <h3 class="style-title-list">
                        {{ $t('%Tf') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t("%U0") }}
                    </p>
                </UploadButton>
            </STListItem>
        </STList>

        <template v-if="images.length > 0">
            <hr>
            <h2 class="style-with-button">
                <div>{{ $t('Foto\'s') }}</div>
                <div>
                    <button type="button" class="button text only-icon-smartphone" @click="images = []">
                        <span class="icon trash" />
                        <span>{{ $t('%Zqe') }}</span>
                    </button>

                    <UploadButton v-model="newImage" :text="$t(`%Zqn`)" :resolutions="resolutions" />
                </div>
            </h2>
            <p>{{ $t('%Zqu') }}</p>

            <STList v-model="images" :draggable="true">
                <template #item="{item: image, index}">
                    <STListItem class="right-stack">
                        <template #left>
                            <div class="product-image-preview">
                                <ImageComponent :image="image" :auto-height="true" :max-height="125" />
                            </div>
                        </template>

                        <h3 class="style-title-list">
                            {{ index === 0 ? $t('%7M') : $t('%Zqt', { number: index + 1 }) }}
                        </h3>

                        <template #right>
                            <button type="button" class="button icon trash gray" @click="removeImage(image)" />
                            <span v-if="images.length > 1" class="button icon drag gray" @click.stop @contextmenu.stop />
                        </template>
                    </STListItem>
                </template>
            </STList>
        </template>

        <hr>
        <h2>
            {{ $t('%1CP') }}
            <span v-if="remainingStock !== null" class="title-suffix">{{ $t('%Th') }} {{ remainingStock }} {{ $t('%14b') }}</span>
        </h2>

        <STList>
            <STListItem v-if="shows(p => p.hidden)" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%Ti') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('%Tj') }}
                </p>
            </STListItem>

            <template v-if="!hidden">
                <STListItem v-if="shows(p => !p.enabled)" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="disabled" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%Tk') }}
                    </h3>
                    <p v-if="disabled" class="style-description-small">
                        {{ $t('%Tl') }}
                    </p>
                </STListItem>

                <template v-if="!disabled">
                    <STListItem v-if="shows(p => p.enableAfter !== null)" :selectable="true" :element-name="useEnableAfter ? 'div' : 'label'">
                        <template #left>
                            <Checkbox v-model="useEnableAfter" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%1CN') }}
                        </h3>
                        <p v-if="useEnableAfter" class="style-description-small">
                            {{ $t('%Tm') }}
                        </p>

                        <div v-if="useEnableAfter" class="split-inputs option">
                            <STInputBox title="" error-fields="enableAfter" :error-box="errorBox">
                                <DateSelection v-model="enableAfter" />
                            </STInputBox>
                            <TimeInput v-model="enableAfter" title="" :validator="validator" />
                        </div>
                    </STListItem>

                    <STListItem v-if="shows(p => p.disableAfter !== null)" :selectable="true" :element-name="useDisableAfter ? 'div' : 'label'">
                        <template #left>
                            <Checkbox v-model="useDisableAfter" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%1CO') }}
                        </h3>
                        <p v-if="useDisableAfter" class="style-description-small">
                            {{ $t('%Tn') }}
                        </p>

                        <div v-if="useDisableAfter" class="split-inputs option">
                            <STInputBox title="" error-fields="disableAfter" :error-box="errorBox">
                                <DateSelection v-model="disableAfter" />
                            </STInputBox>
                            <TimeInput v-model="disableAfter" title="" :validator="validator" />
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useStock" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%To') }} {{ usedStock }} {{ $t('%Tp') }}
                        </h3>

                        <p v-if="useStock" class="style-description-small">
                            {{ $t('%TO') }}
                        </p>

                        <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                            <NumberInputBox v-model="stock" title="" error-fields="stock" :error-box="errorBox" :suffix="$t('%12S')" :suffix-singular="$t('%12Q')" :validator="validator" />
                        </div>
                    </STListItem>

                    <STListItem v-if="hasAnyStock" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useShowStockBelow" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%1H2') }}
                        </h3>

                        <p v-if="useShowStockBelow" class="style-description-small">
                            {{ $t('%1Vt', { showStockBelow: showStockBelow! }) }}
                        </p>

                        <div v-if="useShowStockBelow" class="split-inputs option" @click.stop.prevent>
                            <NumberInputBox v-model="showStockBelow" title="" error-fields="showStockBelow" :error-box="errorBox" :suffix="$t('%12S')" :suffix-singular="$t('%12Q')" :validator="validator" />
                        </div>
                    </STListItem>

                    <STListItem v-if="shows(p => p.maxPerOrder !== null)" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useMaxPerOrder" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%Ts') }}
                        </h3>

                        <p v-if="useMaxPerOrder" class="style-description-small">
                            {{ $t('%Tt') }}
                        </p>

                        <div v-if="useMaxPerOrder" class="split-inputs option" @click.stop.prevent>
                            <NumberInputBox v-model="maxPerOrder" title="" error-fields="maxPerOrder" :error-box="errorBox" :min="1" :validator="validator" />
                        </div>
                    </STListItem>
                </template>
            </template>

            <STListItem v-if="initialProduct.allowMultiple !== null" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="notAllowMultiple" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%Tu') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%Tv') }}
                </p>
            </STListItem>

            <STListItem v-if="modernWebshopEnabled && shows(p => p.enableCustomer)" :selectable="true" element-name="label" data-testid="enable-customer-checkbox">
                <template #left>
                    <Checkbox v-model="enableCustomer" />
                </template>

                <h3 v-if="isTicket" class="style-title-list">
                    {{ $t('%Zzk') }}
                </h3>
                <h3 v-else class="style-title-list">
                    {{ $t('%ZzQ') }}
                </h3>
                <p v-if="isTicket" class="style-description-small">
                    {{ $t('%ZzN') }}
                </p>
                <p v-else class="style-description-small">
                    {{ $t('%a0H') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="modernWebshopEnabled && enableCustomer" class="container">
            <hr>
            <h2 class="style-with-button">
                <div>{{ $t('%Zyo') }}</div>
                <div>
                    <button v-if="customerSettingsBox?.canAdd" v-tooltip="$t('%SN')" class="button icon add" type="button" data-testid="customer-settings-add-button" @click="customerSettingsBox?.showAddMenu($event)" />
                </div>
            </h2>
            <p class="style-description-block">
                {{ $t('%ZyF') }}
            </p>

            <CustomerSettingsBox ref="customerSettingsBox" :customer-settings="customerSettings" :fixed-fields="['name']" :record-editor-settings="customerRecordEditorSettings" :saved-record-ids="savedCustomerRecordIds" @patch="patchCustomerSettings" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, Decoder, PartialWithoutMethods, PatchableArrayAutoEncoder } from '@common/encoding';
import { ObjectData, PatchableArray, VersionBoxDecoder } from '@common/encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import type { Validator } from '@stamhoofd/components/errors/Validator.ts';
import { getSingleFormStepReason } from '@stamhoofd/components/helpers/singleFormStep.ts';
import { useFeatureFlagComputed } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import NumberInputBox from '@stamhoofd/components/inputs/NumberInputBox.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import TimeInput from '@stamhoofd/components/inputs/TimeInput.vue';
import UploadButton from '@stamhoofd/components/inputs/UploadButton.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';

import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useSetUitpasEvent } from '@stamhoofd/components/uitpas/useSetUitpasEvent.ts';
import ImageComponent from '@stamhoofd/components/views/ImageComponent.vue';
import type { Image, PrivateWebshop } from '@stamhoofd/structures';
import { Address, OptionMenu, ProductDateRange, Product, ProductPrice, ProductType, ResolutionRequest, UitpasClientCredentialsStatus, UitpasClientCredentialsStatusHelper, Version, WebshopField, WebshopLayout, WebshopTicketType, ProductLocation } from '@stamhoofd/structures';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Country } from '@stamhoofd/types/Country';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import CustomerSettingsBox from '../CustomerSettingsBox.vue';
import { createParticipantRecordEditorSettings, getParticipantSettingsPatch } from './participantSettings';
import WebshopFieldsBox from '../fields/WebshopFieldsBox.vue';
import OptionMenuSection from './OptionMenuSection.vue';
import { getProductTypeName } from './productTypeName';
import ProductPriceBox from './ProductPriceBox.vue';
import ProductPriceRow from './ProductPriceRow.vue';
import ProductDateRangeInput from './ProductDateRangeInput.vue';
import ProductLocationInput from './ProductLocationInput.vue';
import { useGoToUitpasConfiguration } from './useGoToUitpasConfiguration.ts';

/**
 * The settings of a product, without its own save button (see EditProductView)
 */
const organization = useRequiredOrganization();

const props = withDefaults(defineProps<{
    /**
     * The product with all changes applied
     */
    product: Product;
    /**
     * The webshop with all changes applied, used for the other products and the seating plans
     */
    webshop: PrivateWebshop;
    isNew: boolean;
    errorBox: ErrorBox | null;
    validator: Validator;
    /**
     * The product is the only form of a webshop that orders one at a time (see getSingleFormProduct): the settings
     * that belong to the webshop itself are hidden, unless the product already uses them
     */
    formMode?: boolean;
}>(), {
    formMode: false,
});

const emit = defineEmits<{
    'patch:product': [patch: AutoEncoderPatchType<Product>];
    /** Changes to the webshop itself (seating plans) */
    'patch:webshop': [patch: AutoEncoderPatchType<PrivateWebshop>];
}>();

const present = usePresent();
const uitpasFeature = useFeatureFlagComputed('uitpas');

// The product as it was when editing started: to restore earlier values and to keep showing settings that were in use
const initialProduct = props.product;

const patchedProduct = computed(() => props.product);
const patchedWebshop = computed(() => props.webshop);

function addProductPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<Product>>) {
    emit('patch:product', Product.patch({ id: props.product.id }).patch(Product.patch(patch)));
}

function addWebshopPatch(patch: AutoEncoderPatchType<PrivateWebshop>) {
    emit('patch:webshop', patch);
}

/**
 * Whether a setting that is hidden in form mode is shown, because the product already uses it
 */
function shows(isUsed: (product: Product) => boolean) {
    return !props.formMode || isUsed(initialProduct);
}

const showName = computed(() => shows(p => p.name !== props.webshop.meta.name));
const showType = computed(() => shows(p => p.type === ProductType.Voucher || p.type === ProductType.Person));
const showDescription = computed(() => shows(p => p.description.length > 0));

/**
 * Form mode: older webshops often still have a photo or description on their product, which the webshop shows in a
 * separate step instead of on the page itself. Explains the order button on the webshop and how to get rid of it.
 */
const stepInfo = computed(() => {
    // A hidden product is not on the webshop, so there is no step to explain
    if (!props.formMode || patchedProduct.value.hidden) {
        return null;
    }
    const reason = getSingleFormStepReason(props.webshop, patchedProduct.value);
    if (!reason) {
        return null;
    }
    const texts = [
        reason === 'photo'
            ? $t('Op de webshop opent het formulier in een aparte stap via een knop, omdat dit artikel eigen foto\'s heeft. Verwijder de foto\'s om het formulier op de pagina zelf te tonen.')
            : $t('Op de webshop opent het formulier in een aparte stap via een knop, omdat dit artikel een eigen beschrijving heeft naast de beschrijving van de webshop. Maak de beschrijving van dit artikel leeg, of die van de webshop bij de instellingen van de webshoppagina, om het formulier op de pagina zelf te tonen.'),
    ];
    if (props.webshop.meta.layout === WebshopLayout.Split) {
        texts.push($t('Op brede schermen staat het formulier wel naast de inhoud van de webshop.'));
    }
    return texts.join(' ');
});
const { goToUitpasConfiguration, goToUitpasEventSearch, goToUitpasSettings } = useGoToUitpasConfiguration(patchedProduct, addProductPatch);
const { clearUitpasEvent } = useSetUitpasEvent(patchedProduct, addProductPatch);

onMounted(() => {
    document.body.addEventListener('paste', onPastEventListener);
});

onBeforeUnmount(() => {
    document.body.removeEventListener('paste', onPastEventListener);
});

const atLeastOneUitpasSocialTariff = computed(() => {
    return patchedProduct.value.prices.some(p => !!p.uitpasBaseProductPriceId);
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

                    new Toast($t('%ZyV', { name: decoded.data.name || $t('Naamloos') }), 'copy').show();

                    event.preventDefault();
                }

                // Sanitize the blob if you need to, then process it in your app.
            }
        }
    } catch (err: any) {
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

const typeName = computed(() => getProductTypeName(initialProduct.type));

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
                root: AsyncComponent(() => import('../seating/ChooseSeatingPlanView.vue'), {
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

const nameWarning = computed(() => {
    if (!name.value) {
        return null;
    }
    const lowerName = name.value.toLowerCase().trim();
    for (const p of patchedWebshop.value.products) {
        if (p.id !== props.product.id && p.name && p.name.toLowerCase().trim() === lowerName) {
            return $t('%1PX');
        }
    }
    return null;
});

const seatingWarning = computed(() => {
    if (!patchedProduct.value.seatingPlanId) {
        return null;
    }
    if (!patchedProduct.value.dateRange) {
        return null;
    }

    for (const p of patchedWebshop.value.products) {
        if (p.id !== props.product.id && p.seatingPlanId === patchedProduct.value.seatingPlanId && p.dateRange && p.dateRange.toString() === patchedProduct.value.dateRange.toString()) {
            return $t('%Zs5');
        }
    }

    return null;
});

const location = computed({
    get: () => patchedProduct.value.location,
    set: (location: ProductLocation | null) => {
        addProductPatch({ location });
    },
});

/**
 * Another ticket of this webshop, to start from the same location or date. Copied: changing it never changes the other ticket.
 */
function getOtherProduct(has: (product: Product) => boolean) {
    return patchedWebshop.value.products.find(p => p.id !== props.product.id && has(p)) ?? null;
}

function addLocation() {
    const other = getOtherProduct(p => p.location !== null)?.location;
    location.value = ProductLocation.create({
        name: other?.name ?? '',
        address: other?.address?.clone() ?? Address.createDefault(I18nController.shared?.countryCode ?? Country.Belgium),
    });
}

const dateRange = computed({
    get: () => patchedProduct.value.dateRange,
    set: (dateRange: ProductDateRange | null) => {
        addProductPatch({ dateRange });
    },
});

onMounted(() => {
    // Tickets always have a date
    if (isTicket.value && !dateRange.value) {
        const other = getOtherProduct(p => p.dateRange !== null)?.dateRange;
        // Most events start on the hour, so only the hour needs to be changed
        const now = Formatter.luxon().startOf('hour').toJSDate();
        dateRange.value = ProductDateRange.create({
            startDate: other?.startDate ?? now,
            endDate: other?.endDate ?? now,
        });
    }
});

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
            addProductPatch({ disableAfter: patchedProduct.value.disableAfter ?? initialProduct.disableAfter ?? new Date() });
        } else {
            addProductPatch({ disableAfter: null });
        }
    },
});

const disableAfter = computed({
    get: () => patchedProduct.value.disableAfter ?? initialProduct.disableAfter ?? new Date(),
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
            addProductPatch({ enableAfter: patchedProduct.value.enableAfter ?? initialProduct.enableAfter ?? new Date() });
        } else {
            addProductPatch({ enableAfter: null });
        }
    },
});

const enableAfter = computed({
    get: () => patchedProduct.value.enableAfter ?? initialProduct.enableAfter ?? new Date(),
    set: (enableAfter: Date) => {
        addProductPatch({ enableAfter });
    },
});

const notAllowMultiple = computed({
    get: () => patchedProduct.value.allowMultiple === false,
    set: (notAllowMultiple: boolean) => {
        addProductPatch({ allowMultiple: !notAllowMultiple });
    },
});

const modernWebshopEnabled = useFeatureFlagComputed('modern-webshop');

const enableCustomer = computed({
    get: () => patchedProduct.value.enableCustomer,
    set: (enableCustomer: boolean) => {
        addProductPatch({ enableCustomer });
    },
});

const customerSettings = computed(() => patchedProduct.value.resolvedCustomerSettings);
const customerSettingsBox = useTemplateRef('customerSettingsBox');

function patchCustomerSettings(patch: AutoEncoderPatchType<CustomerSettings>) {
    addProductPatch(getParticipantSettingsPatch(patchedProduct.value, patch));
}

const savedCustomerRecordIds = new Set(props.isNew ? [] : initialProduct.customerSettings?.recordCategory?.getAllRecords().map(r => r.id) ?? []);

const customerRecordEditorSettings = createParticipantRecordEditorSettings(initialProduct);

const remainingStock = computed(() => patchedProduct.value.remainingStock);

const useStock = computed({
    get: () => patchedProduct.value.stock !== null,
    set: (useStock: boolean) => {
        addProductPatch({ stock: useStock ? (patchedProduct.value.stock ?? initialProduct.stock ?? (initialProduct.usedStock || 10)) : null });
    },
});

const stock = computed({
    get: () => patchedProduct.value.stock ?? initialProduct.stock ?? 0,
    set: (stock: number) => {
        addProductPatch({ stock });
    },
});

const useShowStockBelow = computed({
    get: () => patchedProduct.value.showStockBelow !== null,
    set: (useShowStockBelow: boolean) => {
        addProductPatch({ showStockBelow: useShowStockBelow ? (patchedProduct.value.showStockBelow ?? initialProduct.showStockBelow ?? 50) : null });
    },
});

const showStockBelow = computed({
    get: () => patchedProduct.value.showStockBelow,
    set: (showStockBelow: number | null) => {
        addProductPatch({ showStockBelow });
    },
});

const hasAnyStock = computed(() => {
    if (seatingPlan.value) {
        return seatingPlan.value.seatCount > 0;
    }

    return patchedProduct.value.hasAnyStock;
});

const useMaxPerOrder = computed({
    get: () => patchedProduct.value.maxPerOrder !== null,
    set: (useMaxPerOrder: boolean) => {
        addProductPatch({ maxPerOrder: useMaxPerOrder ? (patchedProduct.value.maxPerOrder ?? initialProduct.maxPerOrder ?? 1) : null });
    },
});

const maxPerOrder = computed({
    get: () => patchedProduct.value.maxPerOrder ?? 1,
    set: (maxPerOrder: number) => {
        addProductPatch({ maxPerOrder });
    },
});

const usedStock = computed(() => patchedProduct.value.usedStock);

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

const images = computed<Image[]>({
    get: () => patchedProduct.value.images,
    set: (images: Image[]) => {
        addProductPatch(Product.patch({ images: images as any }));
    },
});

const removeImage = (image: Image) => {
    images.value = images.value.filter(i => i.id !== image.id);
};

const newImage = computed({
    get: () => null,
    set: (image: Image | null) => {
        if (image) {
            const p = Product.patch({});
            p.images.addPut(image);

            addProductPatch(p);
        }
    },
});

function addOptionMenu() {
    const optionMenu = OptionMenu.create({
        name: 'Naamloos',
    });
    optionMenu.options[0].name = 'Naamloos';

    const p = Product.patch({ id: props.product.id });
    p.optionMenus.addPut(optionMenu);

    present(AsyncComponent(() => import('./EditOptionMenuView.vue'), {
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
        AsyncComponent(() => import('../fields/EditWebshopFieldView.vue'), {
            field,
            isNew: true,
            saveHandler: (patch: PatchableArrayAutoEncoder<WebshopField>) => {
                addFieldsPatch(p.patch(patch));
            },
        }).setDisplayStyle('sheet'),
    ).catch(console.error);
}

async function openUitpasEventSearch() {
    const onFixed = async (navigationActions: NavigationActions) => {
        await navigationActions.dismiss();
    };
    await goToUitpasEventSearch(false, onFixed);
}

async function openUitpasSettings() {
    const onFixed = async (navigationActions: NavigationActions) => {
        await navigationActions.dismiss();
    };
    await goToUitpasSettings(onFixed);
}

const productPricesAvailableForUitpasBaseProductPrice = computed(() => {
    return patchedProduct.value.prices.filter(p => (p.uitpasBaseProductPriceId === null));
});

const uitpasBaseProductPriceAvailable = computed(() => {
    return productPricesAvailableForUitpasBaseProductPrice.value.length !== 0;
});

async function addProductPrice(enableUitpasSocialTariff: boolean = false) {
    const price = ProductPrice.create({});
    if (enableUitpasSocialTariff) {
        if (!uitpasBaseProductPriceAvailable.value) {
            // should not be possible
            Toast.error($t('%1AK')).show();
            return;
        }
        const onFixed = async (navigationActions?: NavigationActions) => {
            price.uitpasBaseProductPriceId = productPricesAvailableForUitpasBaseProductPrice.value[0].id;
            price.name = 'UiTPAS kansentarief';
            const p = Product.patch({ id: props.product.id });
            p.prices.addPut(price);
            if (navigationActions) {
                // replace all view on there NavigationController with a product price edit view
                await navigationActions.show({
                    components: [
                        AsyncComponent(() => import('./EditProductPriceView.vue'), {
                            product: patchedProduct.value.patch(p),
                            productPrice: price,
                            isNew: true,
                            saveHandler: (patch: AutoEncoderPatchType<Product>) => {
                                // Merge both patches
                                addProductPatch(p.patch(patch));
                            },
                        }),
                    ],
                    replace: 100,
                });
                return;
            }
            // they didn't make a NavigationController, so we just present the view
            present(AsyncComponent(() => import('./EditProductPriceView.vue'), { product: patchedProduct.value.patch(p), productPrice: price, isNew: true, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
                // Merge both patches
                addProductPatch(p.patch(patch));

                // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
            } }).setDisplayStyle('popup'))
                .catch(console.error);
        };

        await goToUitpasConfiguration(onFixed);
        return;
    }

    const p = Product.patch({ id: props.product.id });
    p.prices.addPut(price);

    present(AsyncComponent(() => import('./EditProductPriceView.vue'), { product: patchedProduct.value.patch(p), productPrice: price, isNew: true, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
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
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.edit-product-box {
    // In form mode the box follows a line on the page, while the settings above the first section are mostly hidden
    &.form-mode > hr:first-child {
        display: none;
    }

    .product-image-preview .image-component {
        width: 80px;
        margin: -5px 0;

        img {
            border-radius: $border-radius;
        }

        @media (max-width: 550px) {
            width: 50px;
        }
    }
}
</style>

<template>
    <SaveView :title="isNew ? typeName+' ' + $t(`34bfcf6f-ac25-45e2-a26b-614384e34923`) : name+' ' + $t(`8455850d-829f-412f-bf1f-eedb2caa9f57`)" :disabled="!hasChanges" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ typeName }} {{ $t('06da1310-e17c-475e-bcd3-bb47844c24c1') }}
        </h1>
        <h1 v-else>
            {{ name || typeName }} {{ $t('ee3bc635-c294-4134-9155-7a74f47dec4f') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <button v-if="!patchedProduct.uitpasEvent && atLeastOneUitpasSocialTariff && uitpasFeature && organization.meta.uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok" type="button" class="warning-box with-button selectable" @click="openUitpasEventSearch()">
            {{ $t('c43f7c56-b6f3-4de5-a543-c4c0c2b8cb6e') }}

            <span class="button text" type="button">
                {{ $t('489734b2-e7e2-4c5e-a9ad-d00c29dc4f8e') }}
            </span>
        </button>
        <button v-else-if="patchedProduct.uitpasEvent && atLeastOneUitpasSocialTariff && uitpasFeature && organization.meta.uitpasClientCredentialsStatus !== UitpasClientCredentialsStatus.Ok" type="button" class="error-box with-button selectable" @click="openUitpasSettings()">
            {{ UitpasClientCredentialsStatusHelper.getName(organization.meta.uitpasClientCredentialsStatus) }}

            <span class="button text" type="button">
                {{ $t('8b74f225-07a7-4b5e-b937-4d479c888789') }}
            </span>
        </button>

        <div class="split-inputs">
            <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`) + ' '+typeName" autocomplete="off" enterkeyhint="next">
            </STInputBox>
            <STInputBox v-if="isTicket" error-fields="type" :error-box="errors.errorBox" :title="$t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`)">
                <Dropdown v-model="type">
                    <option value="Ticket">
                        {{ $t('de971042-551d-43d2-ab47-e76132156887') }}
                    </option>
                    <option value="Voucher">
                        {{ $t('325f85b1-ff89-4bde-a2df-1328c8ea4a3a') }}
                    </option>
                </Dropdown>
            </STInputBox>

            <STInputBox v-else error-fields="type" :error-box="errors.errorBox" :title="$t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`)">
                <Dropdown v-model="type">
                    <option value="Product">
                        {{ $t('e1f32f18-acac-4339-883c-09897ffbd691') }}
                    </option>
                    <option value="Person">
                        {{ $t('9b451e56-b7ae-48ff-811a-a0b4a0175b12') }}
                    </option>
                </Dropdown>
            </STInputBox>
        </div>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`8b049701-1a5f-4b35-bac8-e2b28309ac5f`)" />
        </STInputBox>

        <template v-if="isTicket">
            <hr><h2>{{ $t('7eec15d0-4d60-423f-b860-4f3824271578') }}</h2>
            <ProductSelectLocationInput v-model="location" :locations="allLocations" :validator="errors.validator" @modify="modifyLocation" />

            <hr><h2>{{ $t('436890b3-9e42-4886-98fa-c42c2ac8420a') }}</h2>
            <ProductSelectDateRangeInput v-model="dateRange" :date-ranges="allDateRanges" :validator="errors.validator" @modify="modifyDateRange" />
        </template>

        <template v-if="patchedProduct.uitpasEvent">
            <hr><h2 class="style-with-button">
                <div>{{ $t('1e92a151-6161-4941-aa3f-fa69e14f75ee') }}</div>
                `<button class="button text only-icon-smartphone" type="button" @click="clearUitpasEvent">
                    <span class="icon unlink" />
                    <span>{{ $t('7ec9bfd6-8d4c-4f45-a5e8-7979c747de64') }}</span>
                </button>`
            </h2>
            <p class="style-description-small">
                {{ $t('d0c76989-c11b-4eef-ac8f-3c76e9ad315e') }}
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
                            {{ $t('3b95fc70-7928-426b-b65b-3389d9e762cc') }}
                            <span class="icon arrow-right-small" />
                        </span>
                    </template>
                </STListItem>
            </STList>
        </template>

        <hr><h2 class="style-with-button">
            <div>{{ $t('2b96c0b9-6c20-4962-8e99-ff898d893a0d') }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addProductPrice()">
                    <span class="icon add" />
                    <span>{{ $t('52bff8d2-52af-4d3f-b092-96bcfa4c0d03') }}</span>
                </button>
            </div>
        </h2>
        <p>{{ $t("b81de0d8-04af-48b7-8df4-a5fa51fa60ce") }}</p>

        <ProductPriceBox v-if="patchedProduct.prices.length === 1" :is-new="isNew" :product-price="patchedProduct.prices[0]" :product="patchedProduct" :error-box="errors.errorBox" @patch="addProductPatch($event)" />

        <STList v-else v-model="draggablePrices" :draggable="true">
            <template #item="{item: price}">
                <ProductPriceRow :product-price="price" :product="patchedProduct" @patch="addProductPatch" @move-up="movePriceUp(price)" @move-down="movePriceDown(price)" />
            </template>
        </STList>

        <OptionMenuSection v-for="optionMenu in patchedProduct.optionMenus" :key="optionMenu.id" :option-menu="optionMenu" :product="patchedProduct" @patch="addProductPatch" />

        <template v-if="fields.length">
            <hr><h2 class="style-with-button">
                <div>{{ $t('b8f96d3c-0bd8-493f-834c-aa783bf064ff') }}</div>
                <div>
                    <button class="button icon add" type="button" @click="addField" />
                </div>
            </h2>

            <p>{{ $t("2e53d1ef-56be-45f0-a71b-9cf0fddc481d") }}</p>

            <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />
        </template>

        <hr><STList>
            <STListItem v-if="uitpasFeature && !patchedProduct.prices.some(p => p.uitpasBaseProductPriceId !== null) && uitpasBaseProductPriceAvailable" :selectable="true" element-name="button" @click="addProductPrice(true)">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('29159e0f-2709-48e7-870c-27fb8c002465') }}
                </h3>
            </STListItem>

            <STListItem v-if="seatingPlan" :selectable="true" element-name="button" @click="chooseSeatingPlan">
                <template #left>
                    <span class="icon seat gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('9a9c02aa-ea5a-4882-be31-e650e80f56ec') }}
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
                    {{ $t('792ebf47-4ad3-4d9c-a4ab-f315b715e70e') }}
                </h3>
                <p class="style-description-small">
                    {{ $t(`62d2a48e-46eb-4b9a-8546-66ec8c482cc9`) }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="button" @click="addField">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('04886108-0006-454b-909e-1703681ea5d2') }}
                </h3>
                <p class="style-description-small">
                    {{ $t("bd8e47cd-5d0a-4ca3-b5d2-947e6f7a8299") }}
                </p>
            </STListItem>

            <STListItem v-if="isTicket && !seatingPlan" :selectable="true" element-name="button" @click="chooseSeatingPlan">
                <template #left>
                    <span class="icon seat gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('6e9e9551-10d9-4a06-a850-759c85259c3b') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('6aadf67e-a488-4b32-a838-10a0bf1eb78a') }}
                </p>
            </STListItem>

            <STListItem v-if="!image" :selectable="true" element-name="label" class="button">
                <template #left>
                    <span class="icon camera gray" />
                </template>

                <UploadButton v-model="image" :resolutions="resolutions" element-name="div">
                    <h3 class="style-title-list">
                        {{ $t('acae105a-788b-434a-b476-36764427b635') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t("3e03282d-99d2-4505-b74f-0d5a6d57a8a8") }}
                    </p>
                </UploadButton>
            </STListItem>
        </STList>

        <template v-if="image">
            <hr><h2 class="style-with-button">
                <div>{{ $t('1e7d9358-7f2a-455b-b676-8fb09e26cb3c') }}</div>
                <div>
                    <button v-if="image" type="button" class="button text only-icon-smartphone" @click="image = null">
                        <span class="icon trash" />
                        <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                    </button>
                    <UploadButton v-model="image" :text="image ? $t(`b7c71a71-9523-4748-a6cd-80b9314b05b2`) : $t(`5be27263-6804-4f1c-92b0-f20cdacc141b`)" :resolutions="resolutions" />
                </div>
            </h2>

            <div class="image-box">
                <img v-if="image" :src="imageSrc ?? undefined" class="image">
            </div>
        </template>

        <hr><h2>
            {{ $t('bf2af52c-de5d-4089-b46d-9be48594cdb4') }}
            <span v-if="remainingStock !== null" class="title-suffix">{{ $t('949b7f3f-3aac-4e9c-9b54-d109486eb28a') }} {{ remainingStock }} {{ $t('0467006a-7ded-4e4f-acec-986d013bea6b') }}</span>
        </h2>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('9b385bc1-0c3b-4476-b31d-a8598e381ca4') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('2aa82e9f-9d78-420d-8606-88dca2bb4bef') }}
                </p>
            </STListItem>

            <template v-if="!hidden">
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="disabled" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('11b3bb72-0edb-401e-9c60-47fbb2d132fc') }}
                    </h3>
                    <p v-if="disabled" class="style-description-small">
                        {{ $t('3cd822c4-329e-4e07-97b0-cdb04239b851') }}
                    </p>
                </STListItem>

                <template v-if="!disabled">
                    <STListItem :selectable="true" :element-name="useEnableAfter ? 'div' : 'label'">
                        <template #left>
                            <Checkbox v-model="useEnableAfter" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('c06b7729-059e-46d2-b701-825fa063f315') }}
                        </h3>
                        <p v-if="useEnableAfter" class="style-description-small">
                            {{ $t('1631299a-246c-4923-bc48-a09c6ead77b5') }}
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
                            {{ $t('a0f96736-4411-4439-bb4b-819dd77fca22') }}
                        </h3>
                        <p v-if="useDisableAfter" class="style-description-small">
                            {{ $t('53b8e515-daa7-40ee-8140-c5a6e851a829') }}
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
                            {{ $t('838d249e-8efd-43d7-8026-6e48e9525117') }} {{ usedStock }} {{ $t('aa112df2-654a-4c87-840c-d63823adcca4') }}
                        </h3>

                        <p v-if="useStock" class="style-description-small">
                            {{ $t('31a4cf98-1e98-491e-855c-2b5a5703b254') }}
                        </p>

                        <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                                <NumberInput v-model="stock" :suffix="$t('5cdeae87-7fc9-4b46-b384-f8dabb022a32')" :suffix-singular="$t('7447ec38-44b1-448e-8745-c5aebbdf846b')" />
                            </STInputBox>
                        </div>
                    </STListItem>

                    <STListItem v-if="hasAnyStock" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useShowStockBelow" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('75b1afbb-3595-40da-a97f-fef5172fe58e') }}
                        </h3>

                        <p v-if="useShowStockBelow" class="style-description-small">
                            {{ $t('c6dc2ed9-f90a-425d-970b-dde1ab00d564', { showStockBelow: showStockBelow! }) }}
                        </p>

                        <div v-if="useShowStockBelow" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="showStockBelow" :error-box="showStockBelow">
                                <NumberInput v-model="showStockBelow" :suffix="$t('5cdeae87-7fc9-4b46-b384-f8dabb022a32')" :suffix-singular="$t('7447ec38-44b1-448e-8745-c5aebbdf846b')" />
                            </STInputBox>
                        </div>
                    </STListItem>

                    <STListItem v-if="false && useStock" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="resetStock" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('bf1d7fcd-4f47-4263-8d0b-f7f6dc69e485') }} {{ usedStock }} {{ $t('5625d838-6f25-4e2d-9730-e1fbf3b29a8f') }}
                        </h3>

                        <div v-if="resetStock" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="usedStock" :error-box="errors.errorBox">
                                <NumberInput v-model="usedStock" />
                            </STInputBox>
                        </div>

                        <p class="style-description">
                            {{ $t('31a4cf98-1e98-491e-855c-2b5a5703b254') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="useMaxPerOrder" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('1b0436fb-8c06-4bfc-95c0-391563172a39') }}
                        </h3>

                        <p v-if="useMaxPerOrder" class="style-description-small">
                            {{ $t('e4f5dc91-fb2a-4490-982f-8f8df2d70b3d') }}
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
                    {{ $t('3b458b67-2585-486a-96ba-80c9f5711d20') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('5d52a9c2-e473-494a-a0e5-e087682534a6') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('64bcb0ba-44aa-4ae0-8ab9-84062289cbb1') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, Decoder, ObjectData, PatchableArray, PatchableArrayAutoEncoder, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, Dropdown, NavigationActions, NumberInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Toast, UploadButton, useErrors, useFeatureFlag, usePatch, useRequiredOrganization } from '@stamhoofd/components';
import { Image, OptionMenu, PrivateWebshop, Product, ProductDateRange, ProductLocation, ProductPrice, ProductType, ResolutionRequest, UitpasClientCredentialsStatus, UitpasClientCredentialsStatusHelper, Version, WebshopField, WebshopTicketType } from '@stamhoofd/structures';

import { useGoToUitpasConfiguration } from '@stamhoofd/components/uitpas/useGoToUitpasConfiguration.ts';
import { useSetUitpasEvent } from '@stamhoofd/components/uitpas/useSetUitpasEvent.ts';
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

const organization = useRequiredOrganization();

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
const uitpasFeature = useFeatureFlag()('uitpas');

/// For now only used to update locations and times of other products that are shared
const { patch: patchWebshop, patched: patchedWebshop, addPatch: addWebshopPatch, hasChanges: hasWebshopChanges } = usePatch(props.webshop);
const { patch: patchProduct, patched: patchedProduct, addPatch: addProductPatch, hasChanges: hasProductChanges } = usePatch(props.product);
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

const useShowStockBelow = computed({
    get: () => patchedProduct.value.showStockBelow !== null,
    set: (useShowStockBelow: boolean) => {
        addProductPatch({ showStockBelow: useShowStockBelow ? (patchedProduct.value.showStockBelow ?? props.product.showStockBelow ?? 50) : null });
    },
});

const showStockBelow = computed({
    get: () => patchedProduct.value.showStockBelow,
    set: (showStockBelow: number | null) => {
        addProductPatch({ showStockBelow });
    },
});

const hasAnyStock = computed(() => {
    return patchedProduct.value.hasAnyStock;
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
            Toast.error($t('f6291892-674b-4c66-8855-4937f4d15b86')).show();
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
                        new ComponentWithProperties(EditProductPriceView, {
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
            present(new ComponentWithProperties(EditProductPriceView, { product: patchedProduct.value.patch(p), productPrice: price, isNew: true, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
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

<template>
    <SaveView :title="isNew ? typeName+' toevoegen' : name+' bewerken'" :disabled="!hasChanges" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ typeName }} toevoegen
        </h1>
        <h1 v-else>
            {{ name || typeName }} bewerken
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    :placeholder="'Naam '+typeName"
                    autocomplete=""
                    enterkeyhint="next"
                >
            </STInputBox>
            <STInputBox v-if="isTicket" title="Type" error-fields="type" :error-box="errorBox">
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

            <STInputBox v-else title="Type" error-fields="type" :error-box="errorBox">
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

        <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Beschrijving van dit artikel"
                autocomplete=""
                enterkeyhint="next"
            />
        </STInputBox>

        <template v-if="isTicket">
            <hr>
            <h2>Locatie</h2>
            <ProductSelectLocationInput v-model="location" :locations="allLocations" :validator="validator" @modify="modifyLocation" />

            <hr>
            <h2>Datum en tijd</h2>            
            <ProductSelectDateRangeInput v-model="dateRange" :date-ranges="allDateRanges" :validator="validator" @modify="modifyDateRange" />
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
        <p>Je kan een artikel meerdere prijzen geven en aan elke prijs een naam geven. Bv. small, medium en large. Als je maar één prijs hebt kan je die geen naam geven. Naast meerdere prijzen kan je ook keuzemogelijkheden toevoegen (zie onder).</p>

        <ProductPriceBox v-if="patchedProduct.prices.length == 1" :product-price="patchedProduct.prices[0]" :product="patchedProduct" :error-box="errorBox" @patch="addPatch($event)" />

        <STList v-else v-model="draggablePrices" :draggable="true">
            <ProductPriceRow v-for="price in patchedProduct.prices" :key="price.id" :product-price="price" :product="patchedProduct" @patch="addPatch" @move-up="movePriceUp(price)" @move-down="movePriceDown(price)" />
        </STList>

        <OptionMenuSection v-for="optionMenu in patchedProduct.optionMenus" :key="optionMenu.id" :option-menu="optionMenu" :product="patchedProduct" @patch="addPatch" />

        <hr>
        <h2 class="style-with-button">
            <div>Keuzemenu's</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addOptionMenu">
                    <span class="icon add" />
                    <span>Keuzemenu toevoegen</span>
                </button>
            </div>
        </h2>
        <p>Je kan bij dit artikel nog een keuzemenu toevoegen waarbij men geen, één of meerdere antwoorden moet aanduiden. Elk menu heeft ook een titel, bv. "kies je extra's".</p>

        <hr>
        <h2>Open vragen</h2>
        <p>Je kan ook nog open vragen stellen (bv. 'naam op de trui') waarbij men zelf tekst kan intypen. Let op: voeg hier geen vragen toe die op bestelniveau moeten komen (want dan moet de gebruiker die meerdere keren beantwoorden), dat kan je doen in de instellingen van de webshop zelf.</p>

        <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />

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
        <p>Foto’s worden altijd bijgeknipt tot een vierkant als ze in het overzicht getoond worden. Je hoeft foto's niet zelf bij te knippen. Een portretfoto wordt dus langs boven en onder afgeknipt, en een foto in landschapsoriëntatie wordt links en rechts afgeknipt. In de detailweergave is het soms mogelijk dat we links en rechts nog wat meer plaats hebben en de foto dus wat breder kunnen tonen.</p>

        <div class="image-box">
            <img v-if="image" :src="imageSrc" class="image">
            <img v-if="image" :src="imageSrc2" class="image">
        </div>  
        
        <hr>
        <h2>
            Beschikbaarheid
            {{ remainingStock !== null ? ('(nog '+ remainingStock +' beschikbaar)') : '' }}
        </h2>

        <STList>
            <STListItem v-if="enableBetaFeatures || hidden" :selectable="true" element-name="label">
                <Checkbox slot="left" v-model="hidden" />

                <h3 class="style-title-list">
                    Verbergen op webshop
                </h3>
                <p v-if="hidden" class="style-description-small">
                    Dit artikel wordt onzichtbaar op de webshop en is enkel te bestellen door manueel een bestelling in te geven als beheerder.
                </p>
            </STListItem>
        

            <template v-if="!hidden">
                <STListItem :selectable="true" element-name="label">
                    <Checkbox slot="left" v-model="disabled" />

                    <h3 class="style-title-list">
                        Onbeschikbaar
                    </h3>
                    <p v-if="disabled" class="style-description-small">
                        Zichtbaar op de webshop, maar niet mogelijk om te bestellen.
                    </p>
                </STListItem>

                <template v-if="!disabled">
                    <STListItem v-if="enableBetaFeatures" :selectable="true" element-name="label">
                        <Checkbox slot="left" v-model="useEnableAfter" />

                        <h3 class="style-title-list">
                            Beschikbaar vanaf datum
                        </h3>
                        <p v-if="useEnableAfter" class="style-description-small">
                            Zichtbaar op de webshop, maar pas te bestellen vanaf een bepaalde datum.
                        </p>

                        <div v-if="useEnableAfter" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="enableAfter" :error-box="errorBox">
                                <DateSelection v-model="enableAfter" />
                            </STInputBox>
                            <TimeInput v-model="enableAfter" title="" :validator="validator" />
                        </div>
                    </STListItem>

                    <STListItem v-if="enableBetaFeatures" :selectable="true" element-name="label">
                        <Checkbox slot="left" v-model="useDisableAfter" />

                        <h3 class="style-title-list">
                            Onbeschikbaar na datum
                        </h3>
                        <p v-if="useDisableAfter" class="style-description-small">
                            Zichtbaar op de webshop, maar niet meer te bestellen na een bepaalde datum.
                        </p>

                        <div v-if="useDisableAfter" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="disableAfter" :error-box="errorBox">
                                <DateSelection v-model="disableAfter" />
                            </STInputBox>
                            <TimeInput v-model="disableAfter" title="" :validator="validator" />
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <Checkbox slot="left" v-model="useStock" />

                        <h3 class="style-title-list">
                            Beperk het beschikbare aantal stuks (waarvan nu {{ usedStock }} verkocht of gereserveerd)
                        </h3>

                        <p v-if="useStock" class="style-description-small">
                            Geannuleerde en verwijderde bestellingen worden niet meegerekend.
                        </p>

                        <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="stock" :error-box="errorBox">
                                <NumberInput v-model="stock" />
                            </STInputBox>
                        </div>
                    </STListItem>

                    <STListItem v-if="false && useStock" :selectable="true" element-name="label">
                        <Checkbox slot="left" v-model="resetStock" />

                        <h3 class="style-title-list">
                            Wijzig aantal verkochte stuks manueel (nu {{ usedStock }} verkocht)
                        </h3>

                        <div v-if="resetStock" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="usedStock" :error-box="errorBox">
                                <NumberInput v-model="usedStock" />
                            </STInputBox>
                        </div>

                        <p class="style-description">
                            Geannuleerde en verwijderde bestellingen worden niet meegerekend.
                        </p>
                    </STListItem>

                    <STListItem v-if="enableBetaFeatures || useMaxPerOrder" :selectable="true" element-name="label">
                        <Checkbox slot="left" v-model="useMaxPerOrder" />

                        <h3 class="style-title-list">
                            Beperk het maximaal aantal stuks per bestelling
                        </h3>

                        <p v-if="useMaxPerOrder" class="style-description-small">
                            Het aantal stuks wordt geteld over alle mogelijke keuzes heen en wordt niet gecommuniceerd tenzij men over de limiet gaat.
                        </p>

                        <div v-if="useMaxPerOrder" class="split-inputs option" @click.stop.prevent>
                            <STInputBox title="" error-fields="maxPerOrder" :error-box="errorBox">
                                <NumberInput v-model="maxPerOrder" :min="1" />
                            </STInputBox>
                        </div>
                    </STListItem>
                </template>
            </template>

            <STListItem v-if="enableBetaFeatures" :selectable="true" element-name="label">
                <Checkbox slot="left" v-model="notAllowMultiple" />

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

<script lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, DateSelection, Dropdown, ErrorBox, NumberInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, UploadButton, Validator } from "@stamhoofd/components";
import { Image, OptionMenu, PrivateWebshop, Product, ProductDateRange, ProductLocation, ProductPrice, ProductType, ResolutionFit, ResolutionRequest, Version, WebshopField, WebshopTicketType } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../../classes/OrganizationManager';
import WebshopFieldsBox from "../fields/WebshopFieldsBox.vue";
import EditOptionMenuView from './EditOptionMenuView.vue';
import EditProductPriceView from './EditProductPriceView.vue';
import OptionMenuSection from "./OptionMenuSection.vue";
import ProductPriceBox from "./ProductPriceBox.vue";
import ProductPriceRow from "./ProductPriceRow.vue";
import ProductSelectDateRangeInput from "./ProductSelectDateRangeInput.vue";
import ProductSelectLocationInput from "./ProductSelectLocationInput.vue";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        NumberInput,
        UploadButton,
        ProductPriceRow,
        STList,
        STListItem,
        OptionMenuSection,
        ProductPriceBox,
        WebshopFieldsBox,
        ProductSelectLocationInput,
        ProductSelectDateRangeInput,
        Dropdown,
        DateSelection,
        TimeInput
    },
})
export default class EditProductView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        product!: Product

    @Prop({ required: true })
        isNew!: boolean

    @Prop({ required: true })
        webshop: PrivateWebshop


    /// For now only used to update locations and times of other products that are shared
    patchWebshop:  AutoEncoderPatchType<PrivateWebshop> = PrivateWebshop.patch({})
    patchProduct: AutoEncoderPatchType<Product> = Product.patch({ id: this.product.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get isTicket() {
        return this.type === ProductType.Ticket || this.type === ProductType.Voucher || this.webshop.meta.ticketType === WebshopTicketType.Tickets
    }

    get patchedWebshop() {
        return this.webshop.patch(this.patchWebshop)
    }

    get patchedProduct() {
        return this.product.patch(this.patchProduct)
    }

    get enableBetaFeatures() {
        return OrganizationManager.organization.meta.enableBetaFeatures
    }

    get typeName(): string {
        switch (this.product.type) {
            case ProductType.Product: 
            case ProductType.Person:
                return "Artikel"
            case ProductType.Ticket: return "Ticket"
            case ProductType.Voucher: return "Voucher"
        }
    }

    get fields() {
        return this.patchedProduct.customFields
    }

    addFieldsPatch(patch: PatchableArrayAutoEncoder<WebshopField>) {
        this.addPatch(Product.patch({
            customFields: patch
        }))
    }

    get name() {
        return this.patchedProduct.name
    }

    set name(name: string) {
        this.patchProduct = this.patchProduct.patch({ name })
    }

    get location() {
        return this.patchedProduct.location
    }

    set location(location: ProductLocation | null) {
        this.patchProduct = this.patchProduct.patch({ location })
    }

    get allLocations() {
        const locations = new Map<string, ProductLocation>()

        // Always use the non-patched product here -> only list the locations as they are before starting the editing
        // But do use the patched webshop, because that is where we modify the locations in case of edits
        for (const product of this.patchedWebshop.products) {
            if (product.location) {
                locations.set(product.location.id, product.location)
            }
        }
        return [...locations.values()]
    }

    modifyLocation({ from, to }: { from: ProductLocation, to: ProductLocation }) {
        // We edited/modified a location, so change it in all products
        for (const product of this.patchedWebshop.products) {
            if (product.location && product.location.id === from.id) {
                this.patchWebshop.products.addPatch(Product.patch({
                    id: product.id,
                    location: to
                }))
            }
        }
    }

    get dateRange() {
        return this.patchedProduct.dateRange
    }

    set dateRange(dateRange: ProductDateRange | null) {
        this.patchProduct = this.patchProduct.patch({ dateRange })
    }

    get allDateRanges() {
        const dateRanges = new Map<string, ProductDateRange>()

        // Always use the non-patched product here -> only list the locations as they are before starting the editing
        // But do use the patched webshop, because that is where we modify the locations in case of edits
        for (const product of this.patchedWebshop.products) {
            if (product.dateRange) {
                dateRanges.set(product.dateRange.id, product.dateRange)
            }
        }
        return [...dateRanges.values()]
    }

    modifyDateRange({ from, to }: { from: ProductDateRange, to: ProductDateRange }) {
        // We edited/modified a location, so change it in all products
        for (const product of this.patchedWebshop.products) {
            if (product.dateRange && product.dateRange.id === from.id) {
                this.patchWebshop.products.addPatch(Product.patch({
                    id: product.id,
                    dateRange: to
                }))
            }
        }
    }

    get type() {
        return this.patchedProduct.type
    }

    set type(type: ProductType) {
        this.patchProduct = this.patchProduct.patch({ type })
    }

    get description() {
        return this.patchedProduct.description
    }

    set description(description: string) {
        this.patchProduct = this.patchProduct.patch({ description })
    }

    get disabled() {
        return !this.patchedProduct.enabled
    }

    set disabled(disabled: boolean) {
        this.patchProduct = this.patchProduct.patch({ enabled: !disabled })
    }

    get hidden() {
        return this.patchedProduct.hidden
    }

    set hidden(hidden: boolean) {
        this.patchProduct = this.patchProduct.patch({ hidden })
    }

    get useDisableAfter() {
        return this.patchedProduct.disableAfter !== null
    }

    set useDisableAfter(use: boolean) {
        if (use == this.useDisableAfter) {
            return;
        }
        if (use) {
            this.patchProduct = this.patchProduct.patch({ disableAfter: this.patchedProduct.disableAfter ?? this.product.disableAfter ?? new Date() })
        } else {
            this.patchProduct = this.patchProduct.patch({ disableAfter: null })
        }
    }

    get disableAfter() {
        return this.patchedProduct.disableAfter ?? this.product.disableAfter ?? new Date()
    }

    set disableAfter(disableAfter: Date) {
        this.patchProduct = this.patchProduct.patch({ disableAfter })
    }

    get useEnableAfter() {
        return this.patchedProduct.enableAfter !== null
    }

    set useEnableAfter(use: boolean) {
        if (use == this.useEnableAfter) {
            return;
        }
        if (use) {
            this.patchProduct = this.patchProduct.patch({ enableAfter: this.patchedProduct.enableAfter ?? this.product.enableAfter ?? new Date() })
        } else {
            this.patchProduct = this.patchProduct.patch({ enableAfter: null })
        }
    }

    get enableAfter() {
        return this.patchedProduct.enableAfter ?? this.product.enableAfter ?? new Date()
    }

    set enableAfter(enableAfter: Date) {
        this.patchProduct = this.patchProduct.patch({ enableAfter })
    }

    get notAllowMultiple() {
        return !this.patchedProduct.allowMultiple
    }

    set notAllowMultiple(notAllowMultiple: boolean) {
        this.patchProduct = this.patchProduct.patch({ allowMultiple: !notAllowMultiple })
    }

    get remainingStock() {
        return this.patchedProduct.remainingStock
    }

    get useStock() {
        return this.patchedProduct.stock !== null
    }

    set useStock(useStock: boolean) {
        this.patchProduct = this.patchProduct.patch({ stock: useStock ? (this.patchedProduct.stock ?? this.product.stock ?? (this.product.usedStock || 10)) : null })
    }

    get stock() {
        return this.patchedProduct.stock ?? this.product.stock ?? 0
    }

    set stock(stock: number) {
        this.patchProduct = this.patchProduct.patch({ stock })
    }

    get useMaxPerOrder() {
        return this.patchedProduct.maxPerOrder !== null
    }

    set useMaxPerOrder(useMaxPerOrder: boolean) {
        this.patchProduct = this.patchProduct.patch({ maxPerOrder: useMaxPerOrder ? (this.patchedProduct.maxPerOrder ?? this.product.maxPerOrder ?? 1) : null })
    }

    get maxPerOrder() {
        return this.patchedProduct.maxPerOrder ?? 1
    }

    set maxPerOrder(maxPerOrder: number) {
        this.patchProduct = this.patchProduct.patch({ maxPerOrder })
    }

    get resetStock() {
        return this.patchProduct.usedStock !== undefined
    }

    set resetStock(resetStock: boolean) {
        if (resetStock === this.resetStock) {
            return
        }
        if (resetStock) {
            this.usedStockPatch = this.usedStock
        } else {
            this.usedStockPatch = null
        }
    }

    get usedStockPatch() {
        return this.patchProduct.usedStock ?? null
    }

    set usedStockPatch(usedStock: null | number) {
        if (usedStock === null) {
            this.$set(this.patchProduct, "usedStock", undefined);
            return
        }
        this.usedStock = usedStock
    }

    get usedStock() {
        return this.patchedProduct.usedStock
    }

    set usedStock(usedStock: number) {
        this.patchProduct = this.patchProduct.patch({ usedStock })
    }

    get price() {
        return this.patchedProduct.prices[0]?.price ?? 0
    }

    set price(price: number) {
        const p = this.patchProduct.patch({ })
        p.prices.addPatch(ProductPrice.patch({
            id: this.patchedProduct.prices[0].id,
            price
        }))
    }

    get resolutions() {
        return [
            ResolutionRequest.create({
                height: 500,
            }),
            ResolutionRequest.create({
                height: 250,
                width: 250,
                fit: ResolutionFit.Cover
            })
        ]
    }



    get image() {
        return this.patchedProduct.images[0] ?? null
    }

    set image(image: Image | null) {
        const p = Product.patch({ })

        for (const i of this.patchedProduct.images) {
            p.images.addDelete(i.id)
        }

        if (image) {
            p.images.addPut(image)
        }

        this.patchProduct = this.patchProduct.patch(p)
    }

    get imageSrc() {
        const image = this.image
        if (!image) {
            return null
        }
        return image.getPathForSize(140, 140)
    }

    get imageSrc2() {
        const image = this.image
        if (!image) {
            return null
        }
        const resolution = image.getResolutionForSize(500, 500)
        if (resolution.height >= resolution.width) {
            // Never show photo in portrait mode (they will get cropped to a square)
            return null
        }
        return resolution.file.getPublicPath()
    }

    addPatch(patch: AutoEncoderPatchType<Product>) {
        this.patchProduct = this.patchProduct.patch(patch)
    }

    addOptionMenu() {
        const optionMenu = OptionMenu.create({
            name: "Naamloos"
        })
        optionMenu.options[0].name = "Naamloos"

        const p = Product.patch({ id: this.product.id })
        p.optionMenus.addPut(optionMenu)
        
        this.present(new ComponentWithProperties(EditOptionMenuView, { product: this.patchedProduct.patch(p), optionMenu, isNew: true, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
            // Merge both patches
            this.patchProduct = this.patchProduct.patch(p).patch(patch)

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    addProductPrice() {
        const price = ProductPrice.create({})
        const p = Product.patch({ id: this.product.id })
        p.prices.addPut(price)
        
        this.present(new ComponentWithProperties(EditProductPriceView, { product: this.patchedProduct.patch(p), productPrice: price, isNew: true, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
            // Merge both patches
            this.patchProduct = this.patchProduct.patch(p).patch(patch)

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }

    movePriceUp(price: ProductPrice) {
        const index = this.patchedProduct.prices.findIndex(c => price.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = Product.patch({})
        p.prices.addMove(price.id, this.patchedProduct.prices[moveTo]?.id ?? null)
        this.addPatch(p)
    }

    movePriceDown(price: ProductPrice) {
        const index = this.patchedProduct.prices.findIndex(c => price.id === c.id)
        if (index == -1 || index >= this.patchedProduct.prices.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = Product.patch({})
        p.prices.addMove(price.id, this.patchedProduct.prices[moveTo].id)
        this.addPatch(p)
    }

    get draggablePrices() {
        return this.patchedProduct.prices
    }

    set draggablePrices(prices: ProductPrice[]) {
        if (prices.length != this.patchedProduct.prices.length) {
            return;
        }

        const p = Product.patch({})
        for (const price of prices.slice().reverse()) {
            p.prices.addMove(price.id, null)
        }
        this.addPatch(p)
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }
        const p = PrivateWebshop.patch(this.patchWebshop)
        p.products.addPatch(this.patchProduct)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je dit artikel wilt verwijderen?", "Verwijderen")) {
            return
        }

        const p = PrivateWebshop.patch({})
        p.products.addDelete(this.product.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchProduct, this.product, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.product-edit-view {
    .image-box {
        margin: 0 -5px;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;

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

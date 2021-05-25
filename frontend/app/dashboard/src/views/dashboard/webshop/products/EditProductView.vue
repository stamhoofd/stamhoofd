<template>
    <div class="st-view product-edit-view">
        <STNavigationBar :title="isNew ? 'Artikel toevoegen' : name+' bewerken'">
            <template slot="right">
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Artikel toevoegen
            </h1>
            <h1 v-else>
                {{ name || 'Artikel' }} bewerken
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />
            <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam van dit artikel"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox" class="max">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Beschrijving van dit artikel"
                    autocomplete=""
                />
            </STInputBox>

            <hr>
            <h2 class="style-with-button">
                <div>Prijzen</div>
                <div>
                    <button class="button text" @click="addProductPrice">
                        <span class="icon add" />
                        <span>Prijs</span>
                    </button>
                </div>
            </h2>
            <p>Je kan een artikel meerdere prijzen geven en aan elke prijs een naam geven. Bv. small, medium en large. Als je maar één prijs hebt kan je die geen naam geven. Naast meerdere prijzen kan je ook keuzemogelijkheden toevoegen (zie onder).</p>

            <ProductPriceBox v-if="patchedProduct.prices.length == 1" :product-price="patchedProduct.prices[0]" :product="patchedProduct" :error-box="errorBox" @patch="addPatch($event)" />

            <STList v-else>
                <ProductPriceRow v-for="price in patchedProduct.prices" :key="price.id" :product-price="price" :product="patchedProduct" @patch="addPatch" @move-up="movePriceUp(price)" @move-down="movePriceDown(price)" />
            </STList>

            <OptionMenuSection v-for="optionMenu in patchedProduct.optionMenus" :key="optionMenu.id" :option-menu="optionMenu" :product="patchedProduct" @patch="addPatch" />

            <hr>
            <h2 class="style-with-button">
                <div>Keuzemenu's</div>
                <div>
                    <button class="button text" @click="addOptionMenu">
                        <span class="icon add" />
                        <span>Keuzemenu toevoegen</span>
                    </button>
                </div>
            </h2>
            <p>Je kan bij dit artikel nog extra vragen stellen waaruit men kan kiezen. Per menu kan je kiezen of men één of meerdere (of geen) antwoorden moet aanduiden. Elk menu heeft ook een titel, bv. "kies je extra's".</p>
           
            <hr>
            <h2 class="style-with-button">
                <div>Foto</div>
                <div>
                    <button v-if="image" class="button text" @click="image = null">
                        <span class="icon trash" />
                        <span>Verwijderen</span>
                    </button>
                    <UploadButton v-model="image" :text="image ? 'Vervangen' : 'Foto uploaden'" :resolutions="resolutions" />
                </div>
            </h2>
            <p>Foto’s worden altijd bijgeknipt tot een vierkant als ze in het overzicht getoond worden. Je hoeft foto's zelf niet bij te knippen. Een portretfoto wordt dus langs boven en onder afgeknipt, en een foto in landschapsoriëntatie wordt links en rechts afgeknipt. In de detailweergave is het soms mogelijk dat we links en rechts nog wat meer plaats hebben en de foto dus wat breder kunnen tonen.</p>

            <img v-if="image" :src="imageSrc" class="image">
            <img v-if="image" :src="imageSrc2" class="image">
        
            <hr>
            <h2>
                Voorraad
                {{ remainingStock !== null ? ('(nog '+ remainingStock +' beschikbaar)') : '' }}
            </h2>

            <Checkbox v-model="disabled">
                Tijdelijk niet beschikbaar
            </Checkbox>

            <Checkbox v-model="useStock">
                Beperk het maximaal aantal stuks dat je kan verkopen van dit artikel
            </Checkbox>

            <div v-if="useStock" class="split-inputs">
                <STInputBox title="Totaal aantal beschikbare stuks" error-fields="stock" :error-box="errorBox">
                    <NumberInput v-model="stock" />
                </STInputBox>
            </div>

            <Checkbox v-if="useStock" v-model="resetStock">
                Wijzig aantal verkochte stuks manueel (nu {{ usedStock }} verkocht van de {{ stock }})
            </Checkbox>

            <STInputBox v-if="useStock && resetStock" title="Verkocht aantal stuks" error-fields="usedStock" :error-box="errorBox">
                <NumberInput v-model="usedStock" :max="stock" />
            </STInputBox>

            <p v-if="useStock" class="style-description">
                Als je een bestelling annuleert of verwijdert zullen we de voorraad ook terug aanvullen (tenzij de bestelling geplaatst werd op een moment dat er geen voorraad maximum was). En als je een geannuleerde bestelling terugzet, zullen we ook terug de voorraad aanpassen.
            </p>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, DateSelection, ErrorBox, NumberInput, PriceInput, Radio, RadioGroup, SegmentedControl, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, UploadButton, Validator } from "@stamhoofd/components";
import { Image, OptionMenu, PrivateWebshop, Product, ProductPrice, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditOptionMenuView from './EditOptionMenuView.vue';
import EditProductPriceView from './EditProductPriceView.vue';
import OptionMenuSection from "./OptionMenuSection.vue"
import ProductPriceBox from "./ProductPriceBox.vue"
import ProductPriceRow from "./ProductPriceRow.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        NumberInput,
        Spinner,
        UploadButton,
        ProductPriceRow,
        STList,
        OptionMenuSection,
        ProductPriceBox
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

    patchProduct: AutoEncoderPatchType<Product> = Product.patch({ id: this.product.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get patchedProduct() {
        return this.product.patch(this.patchProduct)
    }

    get name() {
        return this.patchedProduct.name
    }

    set name(name: string) {
        this.patchProduct = this.patchProduct.patch({ name })
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

    get remainingStock() {
        return this.patchedProduct.remainingStock
    }

    get useStock() {
        return this.patchedProduct.stock !== null
    }

    set useStock(useStock: boolean) {
        this.patchProduct = this.patchProduct.patch({ stock: useStock ? (this.patchedProduct.stock ?? 0) : null })
    }

    get stock() {
        return this.patchedProduct.stock ?? 0
    }

    set stock(stock: number) {
        this.patchProduct = this.patchProduct.patch({ stock })
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
        return image.getPathForSize(500, 500)
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

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    addProductPrice() {
        const price = ProductPrice.create({})
        const p = Product.patch({ id: this.product.id })
        p.prices.addPut(price)
        
        this.present(new ComponentWithProperties(EditProductPriceView, { product: this.patchedProduct.patch(p), productPrice: price, isNew: true, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
            // Merge both patches
            this.patchProduct = this.patchProduct.patch(p).patch(patch)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
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

    save() {
        const p = PrivateWebshop.patch({})
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

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchProduct, this.product, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;
@use "@stamhoofd/scss/base/variables.scss" as *;

.product-edit-view {
    img.image {
        margin: 15px 0;
        height: 140px;
        border-radius: $border-radius;
    }
}

.upload-button {

}
</style>

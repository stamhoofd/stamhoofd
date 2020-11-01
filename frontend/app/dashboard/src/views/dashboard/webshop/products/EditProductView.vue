<template>
    <div class="st-view product-edit-view">
        <STNavigationBar :title="isNew ? 'Artikel toevoegen' : name+' bewerken'">
            <template slot="right">
                <button class="button text" v-if="!isNew" @click="deleteMe">
                    <span class="icon trash"/>
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
                {{ name }} bewerken
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
                    <button class="button text">
                        <span class="icon add" />
                        <span>Prijs</span>
                    </button>
                </div>
            </h2>
            <p>Je kan een artikel meerdere prijzen geven en aan elke prijs een naam geven. Bv. small, medium en large. Als je maar één prijs hebt kan je die geen naam geven. Naast meerdere prijzen kan je ook keuzemogelijkheden toevoegen (zie onder).</p>
            
            <STInputBox error-fields="price" :error-box="errorBox">
                <PriceInput v-model="price" placeholder="Gratis" />
            </STInputBox>

            <hr>
            <h2 class="style-with-button">
                <div>Keuzemenu's</div>
                <div>
                    <button class="button text">
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
                    <button class="button text" v-if="image" @click="image = null">
                        <span class="icon trash"/>
                        <span>Verwijderen</span>
                    </button>
                    <UploadButton v-model="image" :text="image ? 'Vervangen' : 'Foto uploaden'" :resolutions="resolutions"/>
                </div>
            </h2>
            <p>Foto’s worden altijd bijgeknipt tot een vierkant als ze in het overzicht getoond worden. Je hoeft foto's zelf niet bij te knippen. Een portretfoto wordt dus langs boven en onder afgeknipt, en een foto in landschapsoriëntatie wordt links en rechts afgeknipt. In de detailweergave is het soms mogelijk dat we links en rechts nog wat meer plaats hebben en de foto dus wat breder kunnen tonen.</p>

            <img v-if="image" :src="imageSrc" class="image" />
            <img v-if="image" :src="imageSrc2" class="image" />
            
            <hr>
            <h2>
                Voorraad
            </h2>

            <Checkbox v-model="disabled">
                Tijdelijk niet beschikbaar
            </Checkbox>

            <Checkbox>
                Beperk het maximaal aantal stuks dat je kan verkopen van dit artikel
            </Checkbox>

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
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AgeInput, CenteredMessage, Checkbox, DateSelection, ErrorBox, UploadButton, PriceInput, Radio, RadioGroup, SegmentedControl, Slider, Spinner,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { Group, GroupGenderType, GroupPatch, GroupPrices, GroupSettings, GroupSettingsPatch, Image, Organization, PrivateWebshop, Product, ProductPrice, ResolutionFit, ResolutionRequest, Version, WaitingListType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

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
        AgeInput,
        Slider,
        Spinner,
        UploadButton
    },
})
export default class EditProductView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    product!: Product

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

    get isNew() {
        return this.product.name.length == 0
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

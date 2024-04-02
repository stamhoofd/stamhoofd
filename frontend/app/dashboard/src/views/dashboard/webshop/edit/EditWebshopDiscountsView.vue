<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errorBox" />

        <hr>
        <h2>Algemene kortingen</h2>
        <p>Algemene kortingen worden automatisch toegepast op alle bestellingen, eventueel onder bepaalde voorwaarden.</p>
        
        <STList v-if="defaultDiscounts.length">
            <STListItem v-for="discount of defaultDiscounts" :key="discount.id" class="right-description right-stack" :selectable="true" @click="editDiscount(discount)">
                <h3 class="style-title-list">
                    {{getDiscountTitle(discount).title}}
                </h3>
                <p class="style-description-small" v-if="getDiscountTitle(discount).description">
                    {{getDiscountTitle(discount).description}}
                </p>
                <p v-if="getDiscountTitle(discount).footnote" class="style-description-small pre-wrap" v-text="getDiscountTitle(discount).footnote"/>


                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add" />
                <span>Algemene korting</span>
            </button>
        </p>

        <hr>
        <h2>Kortingscodes</h2>
        <p>Bestellers kunnen een kortingscode inruilen door een link te gebruiken of door manueel de code in te typen bij het openen van het winkelmandje.</p>

        <Spinner v-if="fetchingDiscountCodes" />
        <div v-else>
            <STList v-if="patchedDiscountCodes.length">
                <STListItem v-for="discountCode of patchedDiscountCodes" :key="discountCode.id" class="right-description right-stack left-center" :selectable="true" @click="editDiscountCode(discountCode)">
                    <span class="icon label" slot="left" />

                    <h3 class="style-title-list">
                        <span class="style-discount-code">{{discountCode.code}}</span>
                    </h3>
                    <p class="style-description-small" v-if="discountCode.description">
                        {{discountCode.description}}
                    </p>
                    <p class="style-description-small">
                        {{discountCode.usageCount}} keer gebruikt
                    </p>
                   
                    <template slot="right">
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            <p class="info-box" v-else>Je hebt nog geen kortingscodes aangemaakt voor deze webshop</p>
        </div>

         <p>
            <button class="button text" type="button" @click="addDiscountCode">
                <span class="icon add" />
                <span>Kortingscode</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from "@simonbackx/simple-encoding";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Spinner } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Discount, DiscountCode, PrivateWebshop, Version, WebshopMetaData } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";
import EditDiscountCodeView from "./discounts/EditDiscountCodeView.vue";
import EditDiscountView from "./discounts/EditDiscountView.vue";

import EditWebshopMixin from './EditWebshopMixin';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        SaveView,
        Spinner
    },
})
export default class EditWebshopDiscountsView extends Mixins(EditWebshopMixin) {
    fetchingDiscountCodes = false;
    discountCodes: DiscountCode[] = []
    patchDiscountCodes: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray()

    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshop.meta.name) + "/settings/discounts")
        this.fetchDiscountCodes().catch(console.error)
    }

    get patchedDiscountCodes() {
        return this.patchDiscountCodes.applyTo(this.discountCodes)
    }

    addDiscountCodesPatch(patchDiscountCodes: PatchableArrayAutoEncoder<DiscountCode>) {
        this.patchDiscountCodes = this.patchDiscountCodes.patch(patchDiscountCodes)
    }

    async fetchDiscountCodes() {
        this.fetchingDiscountCodes = true;
        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: 'GET',
                path: `/webshop/${this.webshop.id}/discount-codes`,
                decoder: new ArrayDecoder(DiscountCode as Decoder<DiscountCode>)
            })
            this.discountCodes = response.data
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.fetchingDiscountCodes = false;
    }

    get viewTitle() {
        return 'Kortingen'
    }
    
    get organization() {
        return SessionManager.currentSession!.organization!
    }

    get defaultDiscounts() {
        return this.webshop.meta.defaultDiscounts
    }

    getDiscountTitle(discount: Discount) {
        return discount.getTitle(this.webshop, true)
    }

    addMetaPatch(meta: AutoEncoderPatchType<WebshopMetaData>) {
        const p = PrivateWebshop.patch({meta})
        this.addPatch(p)
    }

    addDefaultDiscountsPatch(d: PatchableArrayAutoEncoder<Discount>) {
        const meta = WebshopMetaData.patch({defaultDiscounts: d})
        this.addMetaPatch(meta)
    }

    addDiscount() {
        const discount = Discount.create({})
        const arr: PatchableArrayAutoEncoder<Discount> = new PatchableArray();
        arr.addPut(discount);

        this.present({
            components: [
                new ComponentWithProperties(EditDiscountView, {
                    isNew: true,
                    discount,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => {
                        arr.merge(patch);
                        this.addDefaultDiscountsPatch(arr)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    editDiscount(discount: Discount) {
        this.present({
            components: [
                new ComponentWithProperties(EditDiscountView, {
                    isNew: false,
                    discount,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => {
                        this.addDefaultDiscountsPatch(patch)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    addDiscountCode() {
        const discountCode = DiscountCode.create({
            code: ''
        })
        const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
        arr.addPut(discountCode);

        this.present({
            components: [
                new ComponentWithProperties(EditDiscountCodeView, {
                    isNew: true,
                    discountCode,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                        arr.merge(patch);
                        this.addDiscountCodesPatch(arr)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    editDiscountCode(discountCode: DiscountCode) {
        this.present({
            components: [
                new ComponentWithProperties(EditDiscountCodeView, {
                    isNew: false,
                    discountCode,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                        this.addDiscountCodesPatch(patch)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    async afterSave() {
        if (this.patchDiscountCodes.changes.length === 0) {
            return;
        }

        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: 'PATCH',
            path: `/webshop/${this.webshop.id}/discount-codes`,
            body: this.patchDiscountCodes,
            decoder: new ArrayDecoder(DiscountCode as Decoder<DiscountCode>)
        })

        this.patchDiscountCodes = new PatchableArray()
        for (const d of response.data) {
            const existing = this.discountCodes.find(dd => dd.id === d.id)
            if (existing) {
                existing.set(d)
            } else {
                this.discountCodes.push(d)
            }
        }
    }

    get hasChanges() {
        return patchContainsChanges(this.webshopPatch, this.originalWebshop, { version: Version }) || !!this.patchDiscountCodes.changes.length
    }

    validate() {
        
    }
}
</script>

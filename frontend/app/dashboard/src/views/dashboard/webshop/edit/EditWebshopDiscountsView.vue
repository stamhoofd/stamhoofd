<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errorBox" />
        
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
                <span>Korting toevoegen</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { SaveView, STErrorsDefault, STInputBox, STList, STListItem } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Discount, PrivateWebshop, WebshopMetaData } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";
import EditDiscountView from "./discounts/EditDiscountView.vue";

import EditWebshopMixin from './EditWebshopMixin';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        SaveView,
    },
})
export default class EditWebshopDiscountsView extends Mixins(EditWebshopMixin) {
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

    validate() {
        
    }
}
</script>

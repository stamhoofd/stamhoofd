<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Stel hier in waar en wanneer de bestelde producten kunnen worden afgehaald, geleverd of ter plaatse geconsumeerd. Dit is optioneel, maar we raden het wel sterk aan, want zo is de juiste informatie zichtbaar in de bestelbevestiging.</p>

        <STErrorsDefault :error-box="errorBox" />

        <STList>
            <STListItem v-for="method in webshop.meta.checkoutMethods" :key="method.id" :selectable="true" class="right-stack" @click="editCheckoutMethod(method)">
                {{ method.typeName }}: {{ method.name }}

                <template #right>
                    <button class="button icon arrow-up gray" type="button" @click.stop="moveCheckoutUp(method)" />
                    <button class="button icon arrow-down gray" type="button" @click.stop="moveCheckoutDown(method)" />
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
            
        <p>
            <button class="button text" type="button" @click="addOnSiteMethod">
                <span class="icon add" />
                <span>Ter plaatse consumeren toevoegen</span>
            </button>
        </p>

        <p>
            <button class="button text" type="button" @click="addTakeoutMethod">
                <span class="icon add" />
                <span>Afhaallocatie toevoegen</span>
            </button>
        </p>

        <p>
            <button class="button text" type="button" @click="addDeliveryMethod">
                <span class="icon add" />
                <span>Leveringsoptie toevoegen</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { SaveView, STErrorsDefault, STList, STListItem } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { AnyCheckoutMethod, CheckoutMethod, PrivateWebshop, WebshopDeliveryMethod, WebshopMetaData, WebshopOnSiteMethod, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import EditWebshopMixin from './EditWebshopMixin';
import EditDeliveryMethodView from './locations/EditDeliveryMethodView.vue';
import EditTakeoutMethodView from './locations/EditTakeoutMethodView.vue';

@Component({
    components: {
        STListItem,
        STList,
        STErrorsDefault,
        SaveView
    },
})
export default class EditWebshopCheckoutMethodsView extends Mixins(EditWebshopMixin) {
    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshop.meta.name) + "/settings/checkout-methods")
    }
    
    get viewTitle() {
        return "Afhaal- en leveringsopties"
    }

    addOnSiteMethod() {
        const onSiteMethod = WebshopOnSiteMethod.create({
            address: this.$organization.address
        })
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPut(onSiteMethod)
        p.meta = meta

        this.present(new ComponentWithProperties(EditTakeoutMethodView, { 
            isNew: true,
            takeoutMethod: onSiteMethod, 
            webshop: this.webshop.patch(p), 
            saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.addPatch(p.patch(patch))
            }
        }).setDisplayStyle("popup"))
    }

    addTakeoutMethod() {
        const takeoutMethod = WebshopTakeoutMethod.create({
            address: this.$organization.address
        })
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPut(takeoutMethod)
        p.meta = meta

        this.present(new ComponentWithProperties(EditTakeoutMethodView, { 
            isNew: true,
            takeoutMethod, 
            webshop: this.webshop.patch(p), 
            saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.addPatch(p.patch(patch))
            }
        }).setDisplayStyle("popup"))
    }

    addDeliveryMethod() {
        const deliveryMethod = WebshopDeliveryMethod.create({})
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPut(deliveryMethod)
        p.meta = meta

        this.present(new ComponentWithProperties(EditDeliveryMethodView, { 
            isNew: true,
            deliveryMethod, 
            webshop: this.webshop.patch(p), 
            saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.addPatch(p.patch(patch))
            }
        }).setDisplayStyle("popup"))
    }

    editCheckoutMethod(checkoutMethod: AnyCheckoutMethod) {
        if (checkoutMethod instanceof WebshopTakeoutMethod || checkoutMethod instanceof WebshopOnSiteMethod) {
            this.present(
                new ComponentWithProperties(EditTakeoutMethodView, { 
                    isNew: false,
                    takeoutMethod: checkoutMethod, 
                    webshop: this.webshop, 
                    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                        // Merge both patches
                        this.addPatch(patch)
                    }
                }).setDisplayStyle("popup")
            )
        } else {
            this.present(
                new ComponentWithProperties(EditDeliveryMethodView, { 
                    isNew: false,
                    deliveryMethod: checkoutMethod, 
                    webshop: this.webshop, 
                    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                        // Merge both patches
                        this.addPatch(patch)
                    }
                }).setDisplayStyle("popup")
            )
        }
    }

    moveCheckoutUp(location: CheckoutMethod) {
        const index = this.webshop.meta.checkoutMethods.findIndex(c => location.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addMove(location.id, this.webshop.meta.checkoutMethods[moveTo]?.id ?? null)
        p.meta = meta
        this.addPatch(p)
    }

    moveCheckoutDown(location: CheckoutMethod) {
        const index = this.webshop.meta.checkoutMethods.findIndex(c => location.id === c.id)
        if (index == -1 || index >= this.webshop.meta.checkoutMethods.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addMove(location.id,this.webshop.meta.checkoutMethods[moveTo].id)
        p.meta = meta
        this.addPatch(p)
    }
}
</script>

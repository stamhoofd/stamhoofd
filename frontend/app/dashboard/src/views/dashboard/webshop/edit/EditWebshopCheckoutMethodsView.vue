<template>
    <div class="st-view">
        <STNavigationBar :title="viewTitle">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="canDismiss" class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
            <h1>{{ viewTitle }}</h1>
            <p>Stel hier in waar en wanneer de bestelde producten kunnen worden afgehaald, geleverd of ter plaatse geconsumeerd. Dit is optioneel, maar we raden het wel sterk aan, want zo is de juiste informatie zichtbaar in de bestelbevestiging.</p>

            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem v-for="method in webshop.meta.checkoutMethods" :key="method.id" :selectable="true" @click="editCheckoutMethod(method)">
                    {{ method.type == 'OnSite' ? 'Ter plaatse consumeren' : (method.type == 'Takeout' ? 'Afhalen' : 'Leveren') }}: {{ method.name }}

                    <template slot="right">
                        <button class="button icon arrow-up gray" @click.stop="moveCheckoutUp(method)" />
                        <button class="button icon arrow-down gray" @click.stop="moveCheckoutDown(method)" />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            
            <p>
                <button class="button text" @click="addOnSiteMethod">
                    <span class="icon add" />
                    <span>Ter plaatse consumeren toevoegen</span>
                </button>
            </p>

            <p>
                <button class="button text" @click="addTakeoutMethod">
                    <span class="icon add" />
                    <span>Afhaallocatie toevoegen</span>
                </button>
            </p>

            <p>
                <button class="button text" @click="addDeliveryMethod">
                    <span class="icon add" />
                    <span>Leveringsoptie toevoegen</span>
                </button>
            </p>
        </main>
        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton,STErrorsDefault, STInputBox, STList, STListItem,STNavigationBar,STToolbar,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { WebshopOnSiteMethod } from '@stamhoofd/structures';
import { AnyCheckoutMethod, CheckoutMethod, PrivateWebshop, WebshopDeliveryMethod, WebshopMetaData, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import EditWebshopMixin from './EditWebshopMixin';
import EditDeliveryMethodView from './locations/EditDeliveryMethodView.vue';
import EditTakeoutMethodView from './locations/EditTakeoutMethodView.vue';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        STNavigationBar,
        STToolbar,
        LoadingButton,
        BackButton

    },
    directives: { Tooltip },
})
export default class EditWebshopCheckoutMethodsView extends Mixins(EditWebshopMixin) {
    get viewTitle() {
        return "Afhaal- en leveringsopties"
    }

    addOnSiteMethod() {
        const onSiteMethod = WebshopOnSiteMethod.create({
            address: OrganizationManager.organization.address
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
            address: OrganizationManager.organization.address
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

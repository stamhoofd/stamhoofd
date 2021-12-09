<template>
    <div class="st-view webshop-view-details">
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
            <STErrorsDefault :error-box="errorBox" />
        
            <STInputBox title="Naam (kort)" error-fields="meta.name" :error-box="errorBox">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="bv. Wafelverkoop"
                    autocomplete=""
                >
            </STInputBox>


            <template v-if="isNew">
                <hr>
                <h2>Type verkoop</h2>

                <STList>
                    <STListItem :selectable="true" element-name="label" class="left-center">
                        <Radio slot="left" v-model="ticketType" :value="WebshopTicketType.None" />
                        <h3 class="style-title-list">
                            Webshop zonder scanners
                        </h3>
                    </STListItem>
                    <STListItem :selectable="true" element-name="label" class="left-center">
                        <Radio slot="left" v-model="ticketType" :value="WebshopTicketType.SingleTicket" />
                        <h3 class="style-title-list">
                            Ticketverkoop voor groepen
                        </h3>
                        <p class="style-description">
                            Ideaal voor een eetfestijn
                        </p>
                    </STListItem>
                    <STListItem :selectable="true" element-name="label" class="left-center">
                        <Radio slot="left" v-model="ticketType" :value="WebshopTicketType.Tickets" />
                        <h3 class="style-title-list">
                            Ticketverkoop voor personen
                        </h3>
                        <p class="style-description">
                            Ideaal voor een fuif
                        </p>
                    </STListItem>
                </STList>

                <p v-if="ticketType === WebshopTicketType.SingleTicket" class="info-box">
                    Per bestelling wordt er maar één ticket met QR-code aangemaakt. Dus als er 5 spaghetti's en één beenham besteld worden, dan krijgt de besteller één scanbaar ticket.
                </p>
                <p v-if="ticketType === WebshopTicketType.Tickets" class="info-box">
                    Op de webshop staan tickets en vouchers te koop die elk hun eigen QR-code krijgen en apart gescand moeten worden. Ideaal voor een fuif of evenement waar toegang betalend is per persoon. Minder ideaal voor grote groepen omdat je dan elk ticket afzonderlijk moet scannen (dus best niet voor een eetfestijn gebruiken).
                </p>
            </template>

            <hr>
            <h2>Beschikbaarheid</h2>

            <Checkbox v-model="useAvailableUntil">
                Stop bestellingen op een bepaalde datum
            </Checkbox>

            <div v-if="useAvailableUntil" class="split-inputs">
                <STInputBox title="Stop bestellingen op" error-fields="settings.availableUntil" :error-box="errorBox">
                    <DateSelection v-model="availableUntil" />
                </STInputBox>
                <TimeInput v-model="availableUntil" title="Om" :validator="validator" /> 
            </div>
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
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, DateSelection, IBANInput,LoadingButton,Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem,STNavigationBar,STToolbar,TimeInput,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Country, WebshopField, WebshopOnSiteMethod, WebshopTicketType } from '@stamhoofd/structures';
import { AnyCheckoutMethod, CheckoutMethod, PaymentMethod, PrivateWebshop, TransferDescriptionType,TransferSettings,WebshopDeliveryMethod, WebshopMetaData, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import WebshopRolePermissionRow from '../../admins/WebshopRolePermissionRow.vue';
import EditWebshopMixin from './EditWebshopMixin';
import WebshopFieldsBox from './fields/WebshopFieldsBox.vue';
import EditDeliveryMethodView from './locations/EditDeliveryMethodView.vue';
import EditTakeoutMethodView from './locations/EditTakeoutMethodView.vue';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        IBANInput,
        DateSelection,
        TimeInput,
        RadioGroup,
        Radio,
        WebshopRolePermissionRow,
        WebshopFieldsBox,
        EditPaymentMethodsBox,
        STNavigationBar,
        STToolbar,
        LoadingButton,
        BackButton

    },
    directives: { Tooltip },
})
export default class EditWebshopGeneralView extends Mixins(EditWebshopMixin) {
    get viewTitle() {
        if (this.isNew) {
            return "Nieuwe webshop of ticketverkoop starten"
        }
        return "Algemene instellingen"
    }

    get WebshopTicketType() {
        return WebshopTicketType
    }

    get name() {
        return this.webshop.meta.name
    }

    set name(name: string) {
        const patch = WebshopMetaData.patch({ name })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
    }

    get enableBetaFeatures() {
        return OrganizationManager.organization.meta.enableBetaFeatures
    }


    get ticketType() {
        return this.webshop.meta.ticketType
    }

    set ticketType(ticketType: WebshopTicketType) {
        const patch = WebshopMetaData.patch({ ticketType })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }

    get fields() {
        return this.webshop.meta.customFields
    }

    get isTicketType() {
        return (this.webshop.meta.ticketType === WebshopTicketType.Tickets)
    }

    get isAnyTicketType() {
        return (this.webshop.meta.ticketType !== WebshopTicketType.None)
    }

    addFieldsPatch(patch: PatchableArrayAutoEncoder<WebshopField>) {
        this.addPatch(PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                customFields: patch
            })
        }))
    }

    addOnSiteMethod() {
        const onSiteMethod = WebshopOnSiteMethod.create({
            address: OrganizationManager.organization.address
        })
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPut(onSiteMethod)
        p.meta = meta

        this.present(new ComponentWithProperties(EditTakeoutMethodView, { takeoutMethod: onSiteMethod, webshop: this.webshop.patch(p), saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.addPatch(p.patch(patch))
        }}).setDisplayStyle("popup"))
    }

    addTakeoutMethod() {
        const takeoutMethod = WebshopTakeoutMethod.create({
            address: OrganizationManager.organization.address
        })
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPut(takeoutMethod)
        p.meta = meta

        this.present(new ComponentWithProperties(EditTakeoutMethodView, { takeoutMethod, webshop: this.webshop.patch(p), saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.addPatch(p.patch(patch))
        }}).setDisplayStyle("popup"))
    }

    addDeliveryMethod() {
        const deliveryMethod = WebshopDeliveryMethod.create({})
       
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPut(deliveryMethod)
        p.meta = meta

        this.present(new ComponentWithProperties(EditDeliveryMethodView, { deliveryMethod, webshop: this.webshop.patch(p), saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            this.addPatch(p.patch(patch))
        }}).setDisplayStyle("popup"))
    }

    editCheckoutMethod(checkoutMethod: AnyCheckoutMethod) {
        if (checkoutMethod instanceof WebshopTakeoutMethod || checkoutMethod instanceof WebshopOnSiteMethod) {
            this.present(new ComponentWithProperties(EditTakeoutMethodView, { takeoutMethod: checkoutMethod, webshop: this.webshop, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.addPatch(patch)
            }}).setDisplayStyle("popup"))
        } else {
            this.present(new ComponentWithProperties(EditDeliveryMethodView, { deliveryMethod: checkoutMethod, webshop: this.webshop, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.addPatch(patch)
            }}).setDisplayStyle("popup"))
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

    get organization() {
        return SessionManager.currentSession!.organization!
    }

    get useAvailableUntil() {
        return this.webshop.meta.availableUntil !== null
    }

    set useAvailableUntil(use: boolean) {
        if (use == this.useAvailableUntil) {
            return;
        }
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        if (use) {
            meta.availableUntil = new Date()
        } else {
            meta.availableUntil = null
        }
        p.meta = meta
        this.addPatch(p)
    }

    get availableUntil() {
        return this.webshop.meta.availableUntil ?? new Date()
    }

    set availableUntil(availableUntil: Date) {
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.availableUntil = availableUntil
        p.meta = meta
        this.addPatch(p)
    }

    get transferTypes() {
        return [
            { 
                value: TransferDescriptionType.Structured,
                name: this.$t('shared.transferTypes.structured'),
                description: "Willekeurig aangemaakt. Geen kans op typefouten vanwege validatie in bankapps"
            },
            { 
                value: TransferDescriptionType.Reference,
                name: "Bestelnummer",
                description: "Eventueel voorafgegaan door een zelf gekozen woord (zie onder)"
            },
            { 
                value: TransferDescriptionType.Fixed,
                name: "Vaste mededeling",
                description: "Altijd dezelfde mededeling voor alle bestellingen. Opgelet: dit kan niet gewijzigd worden als bestellers de QR-code scannen, voorzie dus zelf geen eigen vervangingen zoals 'bestelling + naam'!"
            }
        ]
    }

    get transferTypeDescription() {
        return this.transferTypes.find(t => t.value === this.transferType)?.description ?? ""
    }

    get creditor() {
        return this.webshop.meta.transferSettings.creditor
    }

    set creditor(creditor: string | null ) {
        const p = PrivateWebshop.patch({})
        p.meta = WebshopMetaData.patch({ 
            transferSettings: TransferSettings.patch({
                creditor: !creditor || creditor.length == 0 || creditor == (this.organization.meta.transferSettings.creditor ?? this.organization.name) ? null : creditor
            })
        })
        this.addPatch(p)
    }

    get iban() {
        return this.webshop.meta.transferSettings.iban
    }

    set iban(iban: string | null ) {
        const p = PrivateWebshop.patch({})
        p.meta = WebshopMetaData.patch({ 
            transferSettings: TransferSettings.patch({
                iban: !iban || iban.length == 0 || iban == this.organization.meta.transferSettings.iban ? null : iban
            })
        })
        this.addPatch(p)
    }

    get prefix() {
        return this.webshop.meta.transferSettings.prefix
    }

    set prefix(prefix: string | null ) {
        const p = PrivateWebshop.patch({})
        p.meta = WebshopMetaData.patch({ 
            transferSettings: TransferSettings.patch({
                prefix
            })
        })
        this.addPatch(p)
    }

    get transferType() {
        return this.webshop.meta.transferSettings.type
    }

    set transferType(type: TransferDescriptionType ) {
        const p = PrivateWebshop.patch({})
        p.meta = WebshopMetaData.patch({ 
            transferSettings: TransferSettings.patch({
                type
            })
        })
        this.addPatch(p)
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    get transferExample() {
        if (this.transferType == TransferDescriptionType.Structured) {
            if (!this.isBelgium) {
                return "4974 3024 6755 6964"
            }
            return "+++705/1929/77391+++"
        }

        if (this.transferType == TransferDescriptionType.Reference) {
            return (this.prefix ? this.prefix+' ' : '') + "152"
        }

        return this.prefix
    }

    get enableTransfers() {
        return this.webshop.meta.paymentMethods.includes(PaymentMethod.Transfer)
    }

    get paymentMethods() {
        return this.webshop.meta.paymentMethods
    }

    validate() {
        if (this.webshop.meta.name.length === 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Name is empty",
                human: "Vul een naam in voor jouw webshop voor je doorgaat",
                field: "meta.name"
            })
        }
    }

    patchPaymentMethods(patch: PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>) {
        this.addPatch(PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                paymentMethods: patch
            })
        }))
    }
}
</script>

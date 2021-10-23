<template>
    <main class="webshop-view-details">
        <STErrorsDefault :error-box="errorBox" />
        
        <STInputBox title="Naam (kort)" error-fields="meta.name" :error-box="errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="bv. eetfestijn"
                autocomplete=""
            >
        </STInputBox>

        <hr>
        <h2>Scannen van tickets en bestellingen</h2>
        <p>Stamhoofd kan automatisch scanbare tickets aanmaken. Je kan dan via de scanner van Stamhoofd tickets scannen. Die worden dan automatisch gemarkeerd als 'gescand' waardoor je ze niet onopgemerkt dubbel kan scannen. De scanner blijft werken als het internet wegvalt, maar bij de start van het evenement is even een internetverbinding nodig.</p>

        <RadioGroup class="column">
            <Radio v-model="ticketType" :value="WebshopTicketType.None">
                <h3 class="style-title-list">
                    Geen scanners gebruiken
                </h3>
                <p class="style-description">
                    Bij het afhalen en leveren werk je gewoon met een lijst waarin je een bestelling opzoekt. Er worden geen QR-codes of tickets aangemaakt die je kan scannen.
                </p>
            </Radio>
            <Radio v-model="ticketType" :value="WebshopTicketType.SingleTicket">
                <h3 class="style-title-list">
                    Maak één scanbaar ticket om bestelling af te halen
                </h3>
                <p class="style-description">
                    Per bestelling wordt er maar één ticket met QR-code aangemaakt die gemakkelijk kan worden gescand bij het afhalen. Ideaal voor een eetfestijn waar je het ticket aan de ingang omruilt voor bonnetjes, of handig als je bestellingen wilt scannen zodat je ze niet moet opzoeken en aanvinken in een lijst. Dus als er 5 spaghetti's en één beenham besteld worden, dan krijgt de besteller één scanbaar ticket.
                </p>
            </Radio>
            <Radio v-model="ticketType" :value="WebshopTicketType.Tickets">
                <h3 class="style-title-list">
                    Verkoop individuele tickets en vouchers
                </h3>
                <p class="style-description">
                    Op de webshop staan tickets en vouchers te koop die elk hun eigen QR-code krijgen en apart gescand moeten worden. Ideaal voor een fuif of evenement waar toegang betalend is per persoon. Minder ideaal voor grote groepen omdat je dan elk ticket afzonderlijk moet scannen (dus best niet voor een eetfestijn gebruiken).
                </p>
            </Radio>
        </RadioGroup>

        <hr>
        <h2>Betaalmethodes</h2>

        <p>Zoek je informatie over alle betaalmethodes, neem dan een kijkje op <a class="inline-link" href="https://stamhoofd.be/docs/online-betalen" target="_blank">deze pagina</a>.</p>

        <EditPaymentMethodsBox :methods="paymentMethods" :organization="organization" @patch="patchPaymentMethods" />

        <p v-if="isAnyTicketType" class="warning-box">
            Bij overschrijvingen wordt er pas een ticket aangemaakt zodra je manueel de betaling als betaald hebt gemarkeerd in Stamhoofd. Bij online betalingen gaat dat automatisch en krijgt men de tickets onmiddelijk.
        </p>

        <template v-if="enableTransfers">
            <hr>
            <h2>Overschrijvingen</h2>

            <STInputBox title="Begunstigde" error-fields="transferSettings.creditor" :error-box="errorBox">
                <input
                    v-model="creditor"
                    class="input"
                    type="text"
                    :placeholder="organization.meta.transferSettings.creditor || organization.name"
                    autocomplete=""
                >
            </STInputBox>

            <IBANInput v-model="iban" title="Bankrekeningnummer" :placeholder="organization.meta.transferSettings.iban || 'Op deze rekening schrijft men over'" :validator="validator" :required="false" />

            <STInputBox title="Soort mededeling" error-fields="transferSettings.type" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-for="_type in transferTypes" :key="_type.value" v-model="transferType" :value="_type.value">
                        {{ _type.name }}
                    </Radio>
                </RadioGroup>
            </STInputBox>
            <p class="style-description-small">
                {{ transferTypeDescription }}
            </p>

            <STInputBox v-if="transferType != 'Structured'" :title="transferType == 'Fixed' ? 'Mededeling' : 'Voorvoegsel'" error-fields="transferSettings.prefix" :error-box="errorBox">
                <input
                    v-model="prefix"
                    class="input"
                    type="text"
                    placeholder="bv. Bestelling"
                    autocomplete=""
                >
            </STInputBox>
            <p class="style-description-small">
                Voorbeeld: “{{ transferExample }}”
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

        <template v-if="!isTicketType">
            <hr>
            <h2>Afhaal- en leveringsopties</h2>
            <p>Stel hier in waar en wanneer de bestelde producten kunnen worden afgehaald, geleverd of ter plaatse geconsumeerd. Dit is optioneel.</p>

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
        </template>

        <hr>
        <h2>Open vragen</h2>
        <p>Je kan zelf nog open vragen stellen (bv. 'naam lid') op bestelniveau (je kan dat ook doen per artikel, maar daarvoor moet je het artikel bewerken). Kies dus verstandig of je het bij een artikel ofwel op bestelniveau toevoegt! Op bestelniveau wordt het maar één keer gevraagd voor de volledige bestelling.</p>

        <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />

        <div v-if="roles.length > 0" class="container">
            <hr>
            <h2>Toegangsbeheer</h2>
            <p>Kies welke beheerdersgroepen toegang hebben tot deze webshop. Vraag aan de hoofdbeheerders om nieuwe beheerdersgroepen aan te maken indien nodig. Hoofdbeheerders hebben altijd toegang tot alle webshops. Enkel beheerders met 'volledige toegang' kunnen instellingen wijzigen van de webshop.</p>

            <STList>
                <WebshopRolePermissionRow v-for="role in roles" :key="role.id" :role="role" :organization="organization" :webshop="webshop" @patch="addPatch" />
            </STList>
        </div>
    </main>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, DateSelection, ErrorBox, IBANInput,Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem,TimeInput,Toast,TooltipDirective as Tooltip, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Country, WebshopField, WebshopOnSiteMethod, WebshopTicketType } from '@stamhoofd/structures';
import { AnyCheckoutMethod, CheckoutMethod, PaymentMethod, PrivateWebshop, TransferDescriptionType,TransferSettings,WebshopDeliveryMethod, WebshopMetaData, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import WebshopRolePermissionRow from '../../admins/WebshopRolePermissionRow.vue';
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
        EditPaymentMethodsBox
    },
    directives: { Tooltip },
})
export default class EditWebshopGeneralView extends Mixins(NavigationMixin) {
    @Prop()
    webshop!: PrivateWebshop;

    errorBox: ErrorBox | null = null
    validator = new Validator()

    get WebshopTicketType() {
        return WebshopTicketType
    }

    get name() {
        return this.webshop.meta.name
    }

    get enableBetaFeatures() {
        return OrganizationManager.organization.meta.enableBetaFeatures
    }

    set name(name: string) {
        const patch = WebshopMetaData.patch({ name })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch}) )
    }

    get ticketType() {
        return this.webshop.meta.ticketType
    }

    set ticketType(ticketType: WebshopTicketType) {
        const patch = WebshopMetaData.patch({ ticketType })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch}) )
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
        this.$emit("patch", PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                customFields: patch
            })
        }))
    }

    addPatch(patch: AutoEncoderPatchType<PrivateWebshop>) {
        this.$emit("patch", patch)
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
            this.$emit("patch", p.patch(patch))
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
            this.$emit("patch", p.patch(patch))
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
            this.$emit("patch", p.patch(patch))
        }}).setDisplayStyle("popup"))
    }

    editCheckoutMethod(checkoutMethod: AnyCheckoutMethod) {
        if (checkoutMethod instanceof WebshopTakeoutMethod || checkoutMethod instanceof WebshopOnSiteMethod) {
            this.present(new ComponentWithProperties(EditTakeoutMethodView, { takeoutMethod: checkoutMethod, webshop: this.webshop, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.$emit("patch", patch)
            }}).setDisplayStyle("popup"))
        } else {
            this.present(new ComponentWithProperties(EditDeliveryMethodView, { deliveryMethod: checkoutMethod, webshop: this.webshop, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                this.$emit("patch", patch)
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
        this.$emit("patch", p)
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
        this.$emit("patch", p)
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
        this.$emit("patch", p)
    }

    get availableUntil() {
        return this.webshop.meta.availableUntil ?? new Date()
    }

    set availableUntil(availableUntil: Date) {
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.availableUntil = availableUntil
        p.meta = meta
        this.$emit("patch", p)
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
                description: "Altijd dezelfde mededeling voor alle bestellingen"
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
        this.$emit("patch", p)
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
        this.$emit("patch", p)
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
        this.$emit("patch", p)
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
        this.$emit("patch", p)
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

    patchPaymentMethods(patch: PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>) {
        this.$emit("patch", PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                paymentMethods: patch
            })
        }))
    }
}
</script>

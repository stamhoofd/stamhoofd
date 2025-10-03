<template>
    <SaveView :title="viewTitle" :save-text="isNew ? 'Aanmaken' : 'Opslaan'" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errorBox" />
        
        <STInputBox title="Naam" error-fields="meta.name" :error-box="errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                :placeholder="namePlaceholder"
                autocomplete=""
            >
        </STInputBox>

        <p v-if="name.length > 30 && isNew" class="style-description-small">
            Lange naam? Je kan de zichtbare titel straks wijzigen bij de instellingen 'Personaliseren'. Hier houd je het beter kort.
        </p>
        <p v-else-if="name.length > 30" class="style-description-small">
            Lange naam? Je kan de zichtbare titel op de webshop apart wijzigen bij de instellingen 'Personaliseren'. Hier houd je het beter kort.
        </p>

        <template v-if="forceType === null || type !== forceType">
            <STInputBox title="Type" error-fields="type" :error-box="errorBox" class="max">
                <div class="illustration-radio-container">
                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Performance" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/stage.svg">
                        </figure>
                        <h3>Zaalvoorstelling</h3>
                        <p>Met tickets en vaste plaatsen</p>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Event" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/tickets.svg">
                        </figure>
                        <h3>Evenement met tickets</h3>
                        <p>Fuif, festival, ...</p>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Registrations" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                        </figure>
                        <h3>Inschrijvingen</h3>
                        <p>Quiz, wandeltocht, eetfestijn, lessen, workshop...</p>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.TakeawayAndDelivery" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/truck.svg">
                        </figure>
                        <h3>Take-away of levering</h3>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Donations" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/charity.svg">
                        </figure>
                        <h3>Donaties of inzameling</h3>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Webshop" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/cart.svg">
                        </figure>
                        <h3>Webshop / andere</h3>
                    </label>
                </div>
            </STInputBox>
            <p v-if="isNew" class="style-description-small">
                Via het type van je webshop helpen we later makkelijk op weg.
            </p>
        </template>

        <template v-if="accessControlList.length > 1">
            <STInputBox :title="accessControlLabel" error-fields="type" :error-box="errorBox" class="max">
                <div class="illustration-radio-container">
                    <label v-for="option in accessControlList" :key="option.value" class="illustration-radio-box">
                        <div>
                            <Radio v-model="ticketType" :value="option.value" />
                        </div>
                        <figure>
                            <img :src="option.src">
                        </figure>
                        <h3>{{ option.label }}</h3>
                        <p v-if="option.tag"><span class="style-tag">{{ option.tag }}</span></p>
                        <p v-if="option.description">{{ option.description }}</p>

                    </label>
                </div>
            </STInputBox>
            <p v-if="ticketType === WebshopTicketType.SingleTicket" class="info-box">
                Per bestelling wordt er maar één ticket met QR-code aangemaakt. Dus als er 5 spaghetti's en één beenham besteld worden, dan krijgt de besteller één scanbaar ticket. Ideaal als je bv. aan de inkom een enveloppe uitdeelt aan elke groep met daarin alle bonnetjes.
            </p>
            <p v-if="ticketType === WebshopTicketType.Tickets" class="info-box">
                Op de webshop staan tickets en vouchers te koop die elk hun eigen QR-code krijgen en apart gescand moeten worden. Minder ideaal voor grote groepen omdat je dan elk ticket afzonderlijk moet scannen (dus best niet voor een eetfestijn gebruiken).
            </p>
        </template>

        <template v-if="!isNew">
            <hr>
            <h2>Beschikbaarheid</h2>

            <Checkbox v-model="hasStatusClosed">
                Manueel gesloten
            </Checkbox>

            <template v-if="!hasStatusClosed">
                <Checkbox v-model="useAvailableUntil">
                    Sluit webshop na een bepaalde datum
                </Checkbox>
                <div v-if="useAvailableUntil" class="split-inputs">
                    <STInputBox title="Stop bestellingen op" error-fields="settings.availableUntil" :error-box="errorBox">
                        <DateSelection v-model="availableUntil" />
                    </STInputBox>
                    <TimeInput v-model="availableUntil" title="Om" :validator="validator" />
                </div>
                <Checkbox v-model="useOpenAt">
                    Open webshop pas na een bepaalde datum
                </Checkbox>
                <div v-if="useOpenAt" class="split-inputs">
                    <STInputBox title="Open op" error-fields="settings.openAt" :error-box="errorBox">
                        <DateSelection v-model="openAt" />
                    </STInputBox>
                    <TimeInput v-model="openAt" title="Om" :validator="validator" />
                </div>
            </template>

            <div class="container">
                <hr>
                <h2>Nummering</h2>

                <STList>
                    <STListItem :selectable="true" element-name="label" class="left-center">
                        <Radio slot="left" v-model="numberingType" :value="WebshopNumberingType.Continuous" />
                        <h3 class="style-title-list">
                            Gebruik opeenvolgende bestelnummers
                        </h3>
                        <p class="style-description">
                            1, 2, 3, ...
                        </p>
                    </STListItem>
                    <STListItem :selectable="true" element-name="label" class="left-center">
                        <Radio slot="left" v-model="numberingType" :value="WebshopNumberingType.Random" />
                        <h3 class="style-title-list">
                            Gebruik willekeurige bestelnummers
                        </h3>
                        <p class="style-description">
                            964824335, 116455337, 228149715, ...
                        </p>
                    </STListItem>
                </STList>

                <STInputBox v-if="numberingType === WebshopNumberingType.Continuous" title="Eerste bestelnummer" error-fields="settings.openAt" :error-box="errorBox">
                    <NumberInput v-model="startNumber" :min="1" :max="100000000 - 100000" />
                </STInputBox>
                <p v-if="!isNew && numberingType === WebshopNumberingType.Continuous" class="style-description-small">
                    Je kan dit enkel wijzigen als je alle bestellingen verwijdert.
                </p>
            </div>
            </hr>
        </template>

        <template v-if="isNew && roles.length > 0">
            <hr>
            <h2>Toegangsbeheer</h2>
            <p>Kies welke beheerdersrollen toegang hebben tot deze webshop (hoofdbeheerders kunnen beheerdersrollen wijzigen via Instellingen → Beheerders)</p>

            <STList>
                <STListItem>
                    <Checkbox slot="left" :checked="true" :disabled="true" />
                    Hoofdbeheerders
                </STListItem>

                <WebshopPermissionRow v-for="role in roles" :key="role.id" type="role" :role="role" :organization="organization" :webshop="webshop" @patch="addPatch" />
            </STList>
        </template>

        <div v-if="stripeAccountObject || hasPayconiq || hasMollieOrBuckaroo" class="container">
            <hr>
            <h2>Betaalmethodes</h2>
            <EditPaymentMethodsBox 
                type="webshop"
                :organization="organization" 
                :webshop="webshop"
                :config="config"
                :private-config="privateConfig" 
                :validator="validator" 
                @patch:config="patchConfig($event)"
                @patch:privateConfig="patchPrivateConfig($event)" 
            />
        </div>

        <div v-if="getFeatureFlag('webshop-auth')" class="container">
            <hr>
            <h2>Inloggen</h2>
            <p>
                Verplicht gebruikers om in te loggen om de webshop te kunnen bekijken.
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <Radio slot="left" v-model="authType" :value="WebshopAuthType.Disabled" />
                    <h3 class="style-title-list">
                        Uitgeschakeld
                    </h3>
                    <p class="style-description">
                        Gebruikers kunnen en moeten niet inloggen om een bestelling te plaatsen.
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <Radio slot="left" v-model="authType" :value="WebshopAuthType.Required" />
                    <h3 class="style-title-list">
                        Verplicht
                    </h3>
                    <p class="style-description">
                        Gebruikers moeten inloggen om de webshop te zien en een bestelling te plaatsen.
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import listIllustrationSrc from '@stamhoofd/assets/images/illustrations/list.svg'
import scannerIllustrationSrc from '@stamhoofd/assets/images/illustrations/scanner.svg'
import teamIllustrationSrc from '@stamhoofd/assets/images/illustrations/team.svg';
import userIllustrationSrc from '@stamhoofd/assets/images/illustrations/user.svg'
import { Checkbox, DateSelection, NumberInput, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Toast } from "@stamhoofd/components";
import { I18nController } from '@stamhoofd/frontend-i18n';
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Country, PaymentConfiguration, PaymentMethod, PaymentMethodHelper, PermissionRole, PermissionsByRole, PrivatePaymentConfiguration, PrivateWebshop, Product, ProductType, StripeAccount, WebshopAuthType, WebshopMetaData, WebshopNumberingType, WebshopPrivateMetaData, WebshopStatus, WebshopTicketType, WebshopType } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import WebshopPermissionRow from '../../admins/WebshopPermissionRow.vue';
import EditWebshopMixin from './EditWebshopMixin';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        TimeInput,
        Radio,
        SaveView,
        WebshopPermissionRow,
        EditPaymentMethodsBox,
        NumberInput
    },
})
export default class EditWebshopGeneralView extends Mixins(EditWebshopMixin) {    
    @Prop({ default: null })
        forceType: WebshopType | null

    created() {
        this.loadStripeAccounts().catch(console.error)
    }
    
    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshop.meta.name) + "/settings/general")
        
        // Auto assign roles
        if (this.isNew && OrganizationManager.user.permissions && !this.webshop.privateMeta.permissions.hasFullAccess(OrganizationManager.user.permissions, this.organization.privateMeta?.roles ?? [])) {
            // By default, add full permissions for all the roles this user has, that also have create webshop permissions
            const roles = OrganizationManager.organization.privateMeta?.roles.flatMap(r => {
                const has = OrganizationManager.user.permissions?.roles.find(i => i.id === r.id)
                if (r.createWebshops && has) {
                    return [PermissionRole.create(r)]
                }
                return []
            }) ?? []

            if (roles.length > 0) {
                const permissions = PermissionsByRole.patch({})
                for (const role of roles) {
                    permissions.full.addPut(role)
                }
                this.addPatch(PrivateWebshop.patch({
                    privateMeta: WebshopPrivateMetaData.patch({
                        permissions
                    })
                }))
            }
        }

        if (this.forceType) {
            this.type = this.forceType
        }
    }
    loadingStripeAccounts = false
    stripeAccounts: StripeAccount[] = []

    get stripeAccountObject() {
        return this.stripeAccounts.find(a => a.id == this.stripeAccountId) ?? null
    }

    get stripeAccountId() {
        return this.privateConfig.stripeAccountId
    }

    set stripeAccountId(value: string | null) {
        this.patchPrivateConfig(PrivatePaymentConfiguration.patch({
            stripeAccountId: value
        }));
    }

    get hasMollieOrBuckaroo() {
        return this.organization.privateMeta?.buckarooSettings !== null || !!this.organization.privateMeta?.mollieOnboarding?.canReceivePayments
    }

    get hasPayconiq() {
        return (this.organization.privateMeta?.payconiqAccounts.length ?? 0) > 0
    }

    async loadStripeAccounts() {
        try {
            this.loadingStripeAccounts = true
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/stripe/accounts",
                decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
                shouldRetry: true,
                owner: this
            })
            this.stripeAccounts = response.data

            if (this.isNew || (!this.hasMollieOrBuckaroo && !this.stripeAccountObject)) {
                this.stripeAccountId = this.stripeAccounts[0]?.id ?? null
            }

            this.$nextTick(() => {
                this.setDefaultSelection()
            })
        } catch (e) {
            console.error(e)
        }
        this.loadingStripeAccounts = false
    }

    get country() {
        return I18nController.shared.country
    }

    getEnableErrorMessage(paymentMethod: PaymentMethod): string | undefined {
        if (paymentMethod === PaymentMethod.Unknown || paymentMethod === PaymentMethod.Transfer || paymentMethod === PaymentMethod.PointOfSale) {
            return
        }

        if (this.organization.privateMeta?.getPaymentProviderFor(paymentMethod, this.stripeAccountObject?.meta))  {
            return;
        }

        if (this.organization.privateMeta?.buckarooSettings?.paymentMethods.includes(paymentMethod)) {
            return
        }

        switch (paymentMethod) {
            case PaymentMethod.Payconiq: {
                if ((this.organization.privateMeta?.payconiqApiKey ?? "").length == 0) {
                    return "Je moet eerst Payconiq activeren via de betaalinstellingen (Instellingen > Betaalmethodes). Daar vind je ook meer informatie."
                }
                break
            }

            case PaymentMethod.iDEAL:
            case PaymentMethod.CreditCard:
            case PaymentMethod.Bancontact: {
                if (this.stripeAccountObject) {
                    return PaymentMethodHelper.getName(paymentMethod)+" is nog niet geactiveerd door Stripe. Kijk na of alle nodige informatie is ingevuld in jullie Stripe dashboard. Vaak is het probleem dat het adres van één van de bestuurders ontbreekt in Stripe of de websitelink van de vereniging niet werd ingevuld."
                }
                break
            }
        }

        return "Je kan "+PaymentMethodHelper.getName(paymentMethod)+" niet activeren, daarvoor moet je eerst aansluiten bij een betaalprovider via de Stamhoofd instellingen > Betaalaccounts."
    }

    getPaymentMethod(method: PaymentMethod) {
        return this.config.paymentMethods.includes(method)
    }

    setPaymentMethod(method: PaymentMethod, enabled: boolean, force = false) {
        if (enabled === this.getPaymentMethod(method)) {
            return
        }
        
        const arr = new PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>()
        if (enabled) {
            const errorMessage = this.getEnableErrorMessage(method)
            if (!force && errorMessage) {
                new Toast(errorMessage, "error red").setHide(15*1000).show()
                return
            }
            arr.addPut(method)
        } else {
            if (!force && this.config.paymentMethods.length == 1) {
                new Toast("Je moet minimaal één betaalmethode accepteren", "error red").show();
                return
            }

            arr.addDelete(method)
        }

        this.patchConfig(PaymentConfiguration.patch({
            paymentMethods: arr
        }))
    }

    canEnablePaymentMethod(method: PaymentMethod) {
        const errorMessage = this.getEnableErrorMessage(method)
        return !errorMessage
    }

    get sortedPaymentMethods() {
        const r: PaymentMethod[] = []

        // Force a given ordering
        if (this.country == Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        // Force a given ordering
        if (this.country == Country.Belgium || this.getPaymentMethod(PaymentMethod.Payconiq)) {
            r.push(PaymentMethod.Payconiq)
        }

        // Force a given ordering
        r.push(PaymentMethod.Bancontact)

        // Force a given ordering
        if (this.country != Country.Netherlands) {
            r.push(PaymentMethod.iDEAL)
        }

        r.push(PaymentMethod.CreditCard)
        
        r.push(PaymentMethod.Transfer)
        r.push(PaymentMethod.PointOfSale)

        // Sort so all disabled are at the end:
        r.sort((a, b) => Sorter.byBooleanValue(this.canEnablePaymentMethod(a), this.canEnablePaymentMethod(b)))
        return r
    }

    setDefaultSelection() {
        if (this.config.paymentMethods.length == 0) {
            const ignore = [
                PaymentMethod.Unknown,
                PaymentMethod.Transfer,
                PaymentMethod.PointOfSale
            ]

            let found = false;

            // Check if online payments are enabled
            for (const p of this.sortedPaymentMethods) {
                if (!ignore.includes(p) && this.canEnablePaymentMethod(p)) {
                    this.setPaymentMethod(p, true)
                    found = true
                }
            }

            if (!found) {
                // Enable point of sale
                this.setPaymentMethod(PaymentMethod.PointOfSale, true)
            }
        } 
    }

    get canChangeType() {
        return true; //this.webshop.products.length == 0 && this.webshop.meta.checkoutMethods.length == 0
    }
    
    get viewTitle() {
        if (this.forceType) {
            switch (this.forceType) {
                case WebshopType.Performance:
                    return "Nieuwe zaalvoorstelling"
                case WebshopType.Event:
                    return "Nieuw evenement met tickets"
                case WebshopType.Registrations:
                    return "Nieuwe inschrijvingen"
                case WebshopType.TakeawayAndDelivery:
                    return "Nieuwe take-away of levering"
                case WebshopType.Donations:
                    return "Nieuwe inzameling"
                default:
                    return "Nieuwe webshop"
            }
        }

        if (this.isNew) {
            return "Nieuwe webshop, ticketverkoop of evenement";
        }
        return "Algemene instellingen"
    }

    get namePlaceholder() {
        switch (this.type) {
            case WebshopType.Performance:
                return "Bv. 'Schaduwen van morgen'"
            case WebshopType.Event:
                return "Bv. Ruimtefestival"
            case WebshopType.Registrations:
                return "Bv. Eetfestijn"
            case WebshopType.TakeawayAndDelivery:
                return "bv. Wijnverkoop"
            case WebshopType.Donations:
                return "bv. Inzameling nieuw materiaal"
            default:
                return "Bv. T-shirts"
        }
    }

    get WebshopTicketType() {
        return WebshopTicketType
    }

    get WebshopType() {
        return WebshopType
    }

    get WebshopNumberingType() {
        return WebshopNumberingType
    }

    get WebshopAuthType() {
        return WebshopAuthType
    }

    get name() {
        return this.webshop.meta.name
    }

    get accessControlLabel() {
        if (this.webshop.meta.type === WebshopType.Webshop || this.webshop.meta.type === WebshopType.TakeawayAndDelivery) {
            return 'Controle bij afhalen/leveren'
        }
        return 'Toegangscontrole'
    }

    get accessControlList() {
        if (this.webshop.meta.type === WebshopType.Webshop 
            || this.webshop.meta.type === WebshopType.TakeawayAndDelivery
        ) {
            return [
                {
                    label: 'Zonder scanners',
                    value: WebshopTicketType.None,
                    src: listIllustrationSrc,
                    tag: 'Meest gekozen'
                },
                {
                    label: 'Bestelling scannen',
                    value: WebshopTicketType.SingleTicket,
                    src: scannerIllustrationSrc
                }
            ]
        }
        
        if (this.webshop.meta.type === WebshopType.Donations) {
            return [
                {
                    label: 'Zonder scannen',
                    value: WebshopTicketType.None,
                    src: listIllustrationSrc
                }
            ]
        }

        if (this.webshop.meta.type === WebshopType.Performance) {
            return [
                {
                    label: 'Ticket per persoon',
                    value: WebshopTicketType.Tickets,
                    src: teamIllustrationSrc
                }
            ]
        }

        const list: { label: string; value: WebshopTicketType; src: string; tag?: string; description?: string }[] = [];

        if (this.webshop.meta.type !== WebshopType.Event) {
            list.push({
                label: 'Zonder scanners',
                value: WebshopTicketType.None,
                src: listIllustrationSrc,
                tag: 'Meest gekozen'
            })
        }

        return [
            ...list,
            {
                label: 'Ticket per persoon',
                value: WebshopTicketType.Tickets,
                src: userIllustrationSrc,
                tag: list.length === 0 ? 'Meest gekozen' : undefined
            },
            {
                label: 'Ticket per bestelling',
                value: WebshopTicketType.SingleTicket,
                src: teamIllustrationSrc
            }
        ]
    }

    set name(name: string) {
        const patch = WebshopMetaData.patch({ name })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }

    get ticketType() {
        return this.webshop.meta.ticketType
    }

    set ticketType(ticketType: WebshopTicketType) {
        const patch = WebshopMetaData.patch({ ticketType })
        const p = PrivateWebshop.patch({ meta: patch})

        // Restore any chagnes to locations
        if (this.webshopPatch.meta) {
            this.webshopPatch.meta.checkoutMethods = patch.checkoutMethods
        }

        // Restore any changes to products
        if (this.webshopPatch) {
            this.webshopPatch.products = p.products
        }

        if (ticketType === WebshopTicketType.Tickets) {
            let used = false;
            // Update all products to not ticket or voucher if needed
            for (const product of this.webshop.products) {
                if (product.type !== ProductType.Ticket && product.type !== ProductType.Voucher) {
                    const productPatch = Product.patch({
                        id: product.id,
                        type: ProductType.Ticket
                    })
                    p.products.addPatch(productPatch)
                    used = true;
                }
            }

            if (used) {
                new Toast('Sommige artikelen zullen worden omgezet in tickets waardoor je hun locatie en datum nog zal moeten invullen', 'warning yellow').setHide(null).show()
            }

            // Remove all locations
            let deletedLocation = false;
            for (const location of this.webshop.meta.checkoutMethods) {
                patch.checkoutMethods.addDelete(location.id)
                deletedLocation = true;
            }

            if (deletedLocation) {
                new Toast('Alle afhaal- en leveringslocaties zullen worden verwijderd als je opslaat omdat deze niet ondersteund worden bij een ticketverkoop voor personen', 'warning yellow').setHide(null).show()
            }
        } else {
            let used = false;
            // Update all products to not ticket or voucher if needed
            for (const product of this.webshop.products) {
                if (product.type === ProductType.Ticket || product.type === ProductType.Voucher) {
                    const productPatch = Product.patch({
                        id: product.id,
                        type: ProductType.Product,
                        location: null,
                        dateRange: null
                    })
                    p.products.addPatch(productPatch)
                    used = true;
                }
            }

            if (used) {
                new Toast('Sommige tickets zullen worden omgezet in gewone artikels waardoor hun locatie en datum informatie verloren gaat als je nu opslaat.', 'warning yellow').setHide(null).show()
            }
        }

        this.addPatch(p)
    }

    get originalNumberingType() {
        return this.originalWebshop.privateMeta.numberingType
    }

    get numberingType() {
        return this.webshop.privateMeta.numberingType
    }

    set numberingType(numberingType: WebshopNumberingType) {
        const patch = WebshopPrivateMetaData.patch({ numberingType })
        this.addPatch(PrivateWebshop.patch({ privateMeta: patch}) )
    }

    get type() {
        return this.webshop.meta.type
    }

    set type(type: WebshopType) {
        if (type === this.type) {
            return;
        }
        const patch = WebshopMetaData.patch({ type })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )

        // If changed to original type again
        if (type === this.originalWebshop.meta.type) {
            // Change back to original ticket type
            this.ticketType = this.originalWebshop.meta.ticketType;
            return;
        } 

        this.$nextTick(() => {
            const list = this.accessControlList;
            if (list.length > 0) {
                const initialType = this.originalWebshop.meta.ticketType;
                const found2 = list.find(i => i.value === initialType);
                if (found2 && !this.isNew) {
                    this.ticketType = initialType;
                    return;
                }

                const found = list.find(i => i.value === this.ticketType);
                if (!found) {
                    this.ticketType = list[0].value
                }
            }
        })
    }

    get startNumber() {
        return this.webshop.privateMeta.startNumber
    }

    set startNumber(startNumber: number) {
        const patch = WebshopPrivateMetaData.patch({ startNumber })
        this.addPatch(PrivateWebshop.patch({ privateMeta: patch}) )
    }

    get authType() {
        return this.webshop.meta.authType
    }

    set authType(authType: WebshopAuthType) {
        const patch = WebshopMetaData.patch({ authType })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
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

    get hasStatusClosed() {
        return this.webshop.meta.status === WebshopStatus.Closed
    }

    set hasStatusClosed(value: boolean) {
        const status = value ? WebshopStatus.Closed : WebshopStatus.Open;
        this.addPatch(PrivateWebshop.patch({ meta: WebshopMetaData.patch({ status }) }));
    }

    get useOpenAt() {
        return this.webshop.meta.openAt !== null
    }

    set useOpenAt(use: boolean) {
        if (use === this.useOpenAt) {
            return;
        }
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        if (use) {
            meta.openAt = new Date()
        } else {
            meta.openAt = null
        }
        p.meta = meta
        this.addPatch(p)
    }

    get openAt() {
        return this.webshop.meta.openAt ?? new Date()
    }

    set openAt(openAt: Date) {
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.openAt = openAt
        p.meta = meta
        this.addPatch(p)
    }

    validate() {
        if (this.webshop.meta.name.trim().length === 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Name is empty",
                human: "Vul een naam in voor jouw webshop voor je doorgaat",
                field: "meta.name"
            })
        }
    }

    get config() {
        return this.webshop.meta.paymentConfiguration
    }

    patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
        this.addPatch(
            PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    paymentConfiguration: patch
                })
            })
        )
    }

    get privateConfig() {
        return this.webshop.privateMeta.paymentConfiguration
    }

    patchPrivateConfig(patch: PrivatePaymentConfiguration | AutoEncoderPatchType<PrivatePaymentConfiguration>) {
        this.addPatch(
            PrivateWebshop.patch({
                privateMeta: WebshopPrivateMetaData.patch({
                    paymentConfiguration: patch
                })
            })
        )
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }
}
</script>

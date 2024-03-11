<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
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

            <p v-if="name.length > 30" class="style-description-small">
                Lange naam? Je kan de zichtbare titel op de webshop apart wijzigen bij de instellingen 'Personaliseren'. Hier houd je het beter kort.
            </p>
        </STInputBox>

        <hr>
        <h2>Type</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <Radio slot="left" v-model="ticketType" :value="WebshopTicketType.None" />
                <h3 class="style-title-list">
                    Geen tickets
                </h3>
                <p class="style-description">
                    Webshop zonder scanners. Er worden geen tickets aangemaakt.
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <Radio slot="left" v-model="ticketType" :value="WebshopTicketType.SingleTicket" />
                <h3 class="style-title-list">
                    Ticketverkoop voor groepen
                </h3>
                <p class="style-description">
                    Eén ticket per bestelling. Ideaal voor een eetfestijn
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <Radio slot="left" v-model="ticketType" :value="WebshopTicketType.Tickets" />
                <h3 class="style-title-list">
                    Ticketverkoop voor personen
                </h3>
                <p class="style-description">
                    Eén ticket per artikel. Ideaal voor een fuif
                </p>
            </STListItem>
        </STList>

        <p v-if="ticketType === WebshopTicketType.SingleTicket" class="info-box">
            Per bestelling wordt er maar één ticket met QR-code aangemaakt. Dus als er 5 spaghetti's en één beenham besteld worden, dan krijgt de besteller één scanbaar ticket.
        </p>
        <p v-if="ticketType === WebshopTicketType.Tickets" class="info-box">
            Op de webshop staan tickets en vouchers te koop die elk hun eigen QR-code krijgen en apart gescand moeten worden. Ideaal voor een fuif of evenement waar toegang betalend is per persoon. Minder ideaal voor grote groepen omdat je dan elk ticket afzonderlijk moet scannen (dus best niet voor een eetfestijn gebruiken).
        </p>

        <hr>
        <h2>Beschikbaarheid</h2>

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

        <div class="container">
            <hr>
            <h2>Nummering</h2>
            <p class="warning-box" v-if="!isNew && originalNumberingType !== WebshopNumberingType.Continuous">
                Je kan de bestelnummering niet meer wijzigen van willekeurig naar opeenvolgend (dupliceer de webshop als je dat toch nog wilt doen). 
            </p>
            <p class="warning-box" v-else-if="numberingType == WebshopNumberingType.Random">
                Je kan de bestelnummering achteraf niet meer wijzigen van willekeurig naar opeenvolgend. 
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <Radio slot="left" v-model="numberingType" :value="WebshopNumberingType.Continuous" :disabled="!isNew && originalNumberingType !== WebshopNumberingType.Continuous" />
                    <h3 class="style-title-list">
                        Gebruik opeenvolgende bestelnummers
                    </h3>
                    <p class="style-description">
                        1, 2, 3, ...
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <Radio slot="left" v-model="numberingType" :value="WebshopNumberingType.Random" :disabled="!isNew && originalNumberingType !== WebshopNumberingType.Continuous" />
                    <h3 class="style-title-list">
                        Gebruik willekeurige bestelnummers
                    </h3>
                    <p class="style-description">
                        964824335, 116455337, 228149715, ...
                    </p>
                </STListItem>
            </STList>
        </div>

        <template v-if="isNew">
            <hr>
            <h2>Betaalmethodes</h2>
            <p>Zoek je informatie over alle betaalmethodes, neem dan een kijkje op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/betaalmethodes-voor-webshops-instellen/'" target="_blank">deze pagina</a>.</p>

            <EditPaymentMethodsBox
                type="webshop"
                :organization="organization" 
                :config="config"
                :private-config="privateConfig" 
                :validator="validator" 
                :show-administration-fee="false" 
                @patch:config="patchConfig($event)"
                @patch:privateConfig="patchPrivateConfig($event)"
            />
        </template>

        <template v-if="isNew && roles.length > 0">
            <hr>
            <h2>Toegangsbeheer</h2>
            <p>Kies welke functies toegang hebben tot deze webshop. Vraag aan de hoofdbeheerders om nieuwe functies aan te maken indien nodig. Hoofdbeheerders hebben altijd toegang tot alle webshops. Enkel beheerders met 'volledige toegang' kunnen instellingen wijzigen van de webshop.</p>

            <STList>
                <WebshopPermissionRow v-for="role in roles" :key="role.id" type="role" :role="role" :organization="organization" :webshop="webshop" @patch="addPatch" />
            </STList>
        </template>

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
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Checkbox, DateSelection, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Toast } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { PaymentConfiguration, PermissionRole, PermissionsByRole, PrivatePaymentConfiguration, PrivateWebshop, Product, ProductType, WebshopAuthType, WebshopMetaData, WebshopNumberingType, WebshopPrivateMetaData, WebshopTicketType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

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
        EditPaymentMethodsBox
    },
})
export default class EditWebshopGeneralView extends Mixins(EditWebshopMixin) {
    mounted() {
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
    }

    get canChangeType() {
        return true; //this.webshop.products.length == 0 && this.webshop.meta.checkoutMethods.length == 0
    }
    
    get viewTitle() {
        if (this.isNew) {
            return "Nieuwe verkoop, inschrijvingsformulier of geldinzameling starten"
        }
        return "Algemene instellingen"
    }

    get WebshopTicketType() {
        return WebshopTicketType
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

    patchPrivateConfig(patch: PrivatePaymentConfiguration) {
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

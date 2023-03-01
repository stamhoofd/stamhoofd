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
        </STInputBox>


        <template v-if="canChangeType">
            <hr>
            <h2>Ticketverkoop</h2>

            <p v-if="isNew" class="info-box">
                Je kan dit achteraf niet meer wijzigen.
            </p>

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

            <template v-if="roles.length > 0">
                <hr>
                <h2>Toegangsbeheer</h2>
                <p>Kies welke beheerdersgroepen toegang hebben tot deze webshop. Vraag aan de hoofdbeheerders om nieuwe beheerdersgroepen aan te maken indien nodig. Hoofdbeheerders hebben altijd toegang tot alle webshops. Enkel beheerders met 'volledige toegang' kunnen instellingen wijzigen van de webshop.</p>

                <STList>
                    <WebshopRolePermissionRow v-for="role in roles" :key="role.id" :role="role" :organization="organization" :webshop="webshop" @patch="addPatch" />
                </STList>
            </template>
        </template>

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

        <div v-if="isNew" class="container">
            <hr>
            <h2>Nummering</h2>
            <p class="info-box">
                Je kan dit achteraf niet meer wijzigen.
            </p>

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
        </div>
    </SaveView>
</template>

<script lang="ts">
import { PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Checkbox, DateSelection, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { PaymentMethod, PermissionLevel, PermissionRole, PermissionsByRole, PrivateWebshop, WebshopMetaData, WebshopNumberingType, WebshopPrivateMetaData, WebshopTicketType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import WebshopRolePermissionRow from '../../admins/WebshopRolePermissionRow.vue';
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
        WebshopRolePermissionRow
    },
})
export default class EditWebshopGeneralView extends Mixins(EditWebshopMixin) {
    mounted() {
        // Auto assign roles
        if (this.isNew && OrganizationManager.user.permissions && this.webshop.privateMeta.permissions.getPermissionLevel(OrganizationManager.user.permissions) !== PermissionLevel.Full) {
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
        return this.webshop.products.length == 0 && this.webshop.meta.checkoutMethods.length == 0
    }
    
    get viewTitle() {
        if (this.isNew) {
            return "Nieuwe verkoop starten"
        }
        return "Algemene instellingen"
    }

    get WebshopTicketType() {
        return WebshopTicketType
    }

    get WebshopNumberingType() {
        return WebshopNumberingType
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
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
    }

    get numberingType() {
        return this.webshop.privateMeta.numberingType
    }

    set numberingType(numberingType: WebshopNumberingType) {
        const patch = WebshopPrivateMetaData.patch({ numberingType })
        this.addPatch(PrivateWebshop.patch({ privateMeta: patch}) )
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

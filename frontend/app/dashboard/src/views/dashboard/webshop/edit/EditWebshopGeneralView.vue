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
    </SaveView>
</template>

<script lang="ts">
import { PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Checkbox, DateSelection, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { PaymentMethod, PrivateWebshop, WebshopMetaData, WebshopTicketType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

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
    },
})
export default class EditWebshopGeneralView extends Mixins(EditWebshopMixin) {
    get viewTitle() {
        if (this.isNew) {
            return "Nieuwe verkoop starten"
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

    get ticketType() {
        return this.webshop.meta.ticketType
    }

    set ticketType(ticketType: WebshopTicketType) {
        const patch = WebshopMetaData.patch({ ticketType })
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

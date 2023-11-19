<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Je kan zelf nog open vragen stellen (bv. 'naam lid') op bestelniveau (je kan dat ook doen per artikel, maar daarvoor moet je het artikel bewerken). Kies dus verstandig of je het bij een artikel ofwel op bestelniveau toevoegt! Op bestelniveau wordt het maar één keer gevraagd voor de volledige bestelling.</p>
        
        <p class="warning-box">
            Deze functie is verouderd. Als je alle vrije invoervelden wist, en daarna opslaat, kan je gebruik maken van uitgebreidere vragenlijsten.
        </p>

        <STErrorsDefault :error-box="errorBox" />
        <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />
    </SaveView>
</template>

<script lang="ts">
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SaveView, STErrorsDefault } from "@stamhoofd/components";
import { PrivateWebshop, WebshopField, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditWebshopMixin from './EditWebshopMixin';
import WebshopFieldsBox from './fields/WebshopFieldsBox.vue';

@Component({
    components: {
        STErrorsDefault,
        WebshopFieldsBox,
        SaveView,
    }
})
export default class EditWebshopInputFieldsView extends Mixins(EditWebshopMixin) {
    get viewTitle() {
        return "Vrije invoervelden"
    }

    get fields() {
        return this.webshop.meta.customFields
    }


    addFieldsPatch(patch: PatchableArrayAutoEncoder<WebshopField>) {
        this.addPatch(PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                customFields: patch
            })
        }))
    }
}
</script>

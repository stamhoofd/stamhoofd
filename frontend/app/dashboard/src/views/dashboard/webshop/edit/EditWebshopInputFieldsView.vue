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
            <p>Je kan zelf nog open vragen stellen (bv. 'naam lid') op bestelniveau (je kan dat ook doen per artikel, maar daarvoor moet je het artikel bewerken). Kies dus verstandig of je het bij een artikel ofwel op bestelniveau toevoegt! Op bestelniveau wordt het maar één keer gevraagd voor de volledige bestelling.</p>
            <STErrorsDefault :error-box="errorBox" />
            <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />
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
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { BackButton, LoadingButton, STErrorsDefault, STNavigationBar, STToolbar, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { PrivateWebshop, WebshopField, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditWebshopMixin from './EditWebshopMixin';
import WebshopFieldsBox from './fields/WebshopFieldsBox.vue';

@Component({
    components: {
        STErrorsDefault,
        WebshopFieldsBox,
        STNavigationBar,
        STToolbar,
        LoadingButton,
        BackButton

    },
    directives: { Tooltip },
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

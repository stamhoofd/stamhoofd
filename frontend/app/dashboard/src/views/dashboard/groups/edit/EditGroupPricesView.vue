<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />
        <EditGroupPriceBox :validator="validator" :prices="getPrices()" :group="patchedGroup" :organization="organization" :period="patchedPeriod" @patch="addPricesPatch" />
    </SaveView>
</template>

<script lang="ts">
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { STErrorsDefault, SaveView } from "@stamhoofd/components";

import EditGroupPriceBox from "../EditGroupPriceBox.vue";
import EditGroupMixin from './EditGroupMixin';

@Component({
    components: {
        SaveView,
        STErrorsDefault,
        EditGroupPriceBox,
    },
})
export default class EditGroupPricesView extends Mixins(EditGroupMixin) {
    get title() {
        return 'Prijs en kortingen'
    }

    getPrices() {
        return this.patchedGroup.settings.oldPrices
    }
}
</script>

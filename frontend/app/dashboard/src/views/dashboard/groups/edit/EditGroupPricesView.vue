<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />
        <EditGroupPriceBox :validator="validator" :prices="getPrices()" :group="patchedGroup" :patched-organization="patchedOrganization" @patch="addPricesPatch" />
    </SaveView>
</template>

<script lang="ts">
import { AgeInput, Checkbox, DateSelection, PriceInput, Radio, RadioGroup, SaveView, SegmentedControl, Slider, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, UploadButton } from "@stamhoofd/components";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import GroupPermissionRow from "../../admins/GroupPermissionRow.vue";
import EditGroupPriceBox from "../EditGroupPriceBox.vue";
import EditGroupMixin from './EditGroupMixin';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        AgeInput,
        Slider,
        TimeInput,
        EditGroupPriceBox,
        STList,
        GroupPermissionRow,
        UploadButton,
        STListItem
    },
})
export default class EditGroupPricesView extends Mixins(EditGroupMixin) {
    get title() {
        return 'Prijs en kortingen'
    }

    getPrices() {
        return this.patchedGroup.settings.prices
    }
}
</script>
<template>
    <div class="webshop-view-details">
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

       
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STListItem,TooltipDirective as Tooltip, STInputBox, STErrorsDefault, Validator } from "@stamhoofd/components";
import { EmergencyContact,MemberWithRegistrations, Parent, ParentTypeHelper, PrivateWebshop, Record, RecordTypeHelper, RecordTypePriority, Webshop, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import EditMemberEmergencyContactView from './edit/EditMemberEmergencyContactView.vue';
import EditMemberGroupView from './edit/EditMemberGroupView.vue';
import EditMemberParentView from './edit/EditMemberParentView.vue';
import EditMemberView from './edit/EditMemberView.vue';
import MemberView from './MemberView.vue';
import RecordDescriptionView from './records/RecordDescriptionView.vue';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault
    },
    directives: { Tooltip },
})
export default class EditWebshopGeneralView extends Mixins(NavigationMixin) {
    @Prop()
    webshop!: PrivateWebshop;

    errorBox: ErrorBox | null = null
    validator = new Validator()

    get name() {
        return this.webshop.meta.name
    }

    set name(name: string) {
        const patch = WebshopMetaData.patch({ name })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch}) )
    }

  
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>

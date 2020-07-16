<template>
    <div id="member-records-view" class="st-view">
        <STNavigationBar title="Steekkaart">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">Terug</button>
        </STNavigationBar>
        
        <main>
            <h1>
                Persoonlijke steekkaart van {{ member.firstName }} <span class="icon gray privacy" />
            </h1>

           

        </main>
        <STToolbar>
            <button  slot="right" class="button secundary" @click="goNext">
                Doorgaan
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator, STList, STListItem, Checkbox } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import ParentView from './ParentView.vue';
import EmergencyContactView from './EmergencyContactView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        STList,
        STListItem,
        Checkbox
    }
})
export default class MemberRecordsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberDetails
    
    async goNext() {
        // todo
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#member-records-view {
    
}
</style>

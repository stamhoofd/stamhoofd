<template>
    <div class="st-view">
        <STNavigationBar :title="'Heeft '+ member.firstName + ' een broer of zus die al langer lid is?'">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" v-else-if="canDismiss" class="button icon gray close" @click="dismiss" type="button"></button>
        </STNavigationBar>
        
        <main>
            <h1>
                Heeft {{ member.firstName }} een broer of zus die al langer lid is?
            </h1>

            <p class="warning-box">Je kan dit later niet meer wijzigen. Lees goed na!</p>

            <STErrorsDefault :error-box="errorBox" />
            <STList>
                <STListItem :selectable="true" element-name="label" class="right-stack left-center">
                    <Radio slot="left" @click.stop name="choose-answer" v-model="hasFamily" :value="true"/>
                    <h2 class="style-title-list">Ja, {{ member.firstName }} heeft een broer of zus dat al langer lid is</h2>
                    <p class="style-description-small">Duid enkel aan voor een reeds broer of zus vorig jaar al ingeschreven was!</p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="right-stack left-center">
                    <Radio slot="left" @click.stop name="choose-answer" v-model="hasFamily" :value="false"/>
                    <h2 class="style-title-list">Nee</h2>
                    <p class="style-description-small">{{ member.firstName }} heeft geen broer of zus dat al langer lid is of enkel een broer / zus die ook een nieuw lid is</p>
                </STListItem>
                
            </STList>
        </main>

        <STToolbar>
            <Spinner slot="right" v-if="loading" />
            <button  slot="right" class="button primary" @click="goNext">
                Volgende
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STNavigationBar, STToolbar, Radio, STList, STListItem, Spinner, BackButton, Checkbox } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent, Group, MemberExistingStatus } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import MemberParentsView from './MemberParentsView.vue';
import { OrganizationManager } from '../../classes/OrganizationManager';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        Radio,
        STList,
        STListItem,
        Spinner,
        BackButton,
        Checkbox
    }
})
export default class MemberExistingFamilyQuestionView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberDetails // will modify

    @Prop({ required: true })
    handler: (component: NavigationMixin) => void;

    errorBox: ErrorBox | null = null

    hasFamily: boolean | null = null

    /// Loading value can get set inside handler by caller
    loading = false

    mounted() {
        if (this.member.existingStatus) {
            this.hasFamily = this.member.existingStatus.hasFamily
        }
    }
 
    async goNext() {
        if (this.loading) {
            return;
        }
        if (this.hasFamily === null) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "not_selected",
                message: "Maak een keuze"
            }))
            return;
        }
        this.errorBox = null
        this.member.existingStatus = MemberExistingStatus.create({
            isNew: true,
            hasFamily: this.hasFamily
        })
        this.handler(this)
    }
}
</script>
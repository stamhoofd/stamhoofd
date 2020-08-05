<template>
    <div class="st-view">
        <STNavigationBar :title="'Is '+ member.firstName + ' al langer lid?'">
            <button slot="right" class="button icon gray close" @click="dismiss" type="button"></button>
        </STNavigationBar>
        
        <main>
            <h1>
                Is {{ member.firstName }} al langer lid?
            </h1>

            <STErrorsDefault :error-box="errorBox" />
            <STList>
                <STListItem :selectable="true" element-name="label" class="right-stack left-center">
                    <Radio slot="left" @click.stop name="choose-answer" v-model="isNew" :value="true"/>
                    <h2 class="style-title-list">{{ member.firstName }} is een nieuw lid</h2>
                    <p class="style-description-small">{{ member.firstName }} zal voor de eerste keer ingeschreven worden</p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="right-stack left-center">
                    <Radio slot="left" @click.stop name="choose-answer" v-model="isNew" :value="false"/>
                    <h2 class="style-title-list">{{ member.firstName }} is een bestaand lid </h2>
                    <p class="style-description-small">{{ member.firstName }} was vorig jaar al ingeschreven</p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="right-stack left-center" v-if="isNew">
                    <Checkbox slot="left" @click.stop name="choose-answer" v-model="hasFamily" :value="true"/>
                    <h2 class="style-title-list">{{ member.firstName }} heeft een broer of zus die al een bestaand lid is</h2>
                    <p class="style-description-small">Een broer of zus van {{ member.firstName }} was vorig jaar al ingeschreven</p>
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
export default class MemberExistingQuestionView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberDetails // will modify

    @Prop({ required: true })
    handler: (component: MemberExistingQuestionView) => void;

    errorBox: ErrorBox | null = null

    isNew: boolean | null = null
    hasFamily = false

    /// Loading value can get set inside handler by caller
    loading = false

    mounted() {
        if (this.member.existingStatus) {
            this.isNew = this.member.existingStatus.isNew
            this.hasFamily = this.member.existingStatus.hasFamily
        }
    }
 
    async goNext() {
        if (this.loading) {
            return;
        }
        if (this.isNew === null) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "not_selected",
                message: "Maak een keuze"
            }))
            return;
        }
        this.errorBox = null
        this.member.existingStatus = MemberExistingStatus.create({
            isNew: this.isNew,
            hasFamily: this.hasFamily
        })
        this.handler(this)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#group-selection-view {
}
</style>

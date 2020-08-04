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
                    <Radio slot="left" @click.stop name="choose-answer" v-model="existingMember" :value="false"/>
                    <h2 class="style-title-list">{{ member.firstName }} is een nieuw lid</h2>
                    <p class="style-description-small">{{ member.firstName }} zal voor de eerste keer ingeschreven worden</p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="right-stack left-center">
                    <Radio slot="left" @click.stop name="choose-answer" v-model="existingMember" :value="true"/>
                    <h2 class="style-title-list">{{ member.firstName }} is een bestaand lid </h2>
                    <p class="style-description-small">{{ member.firstName }} was vorig jaar al ingeschreven</p>
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
import { ErrorBox, STErrorsDefault, STNavigationBar, STToolbar, Radio, STList, STListItem, Spinner, BackButton } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent, Group } from "@stamhoofd/structures"
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
        BackButton
    }
})
export default class MemberExistingQuestionView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberDetails // tood

    @Prop({ required: true })
    handler: (existingMember: boolean, component: MemberExistingQuestionView) => void;

    errorBox: ErrorBox | null = null

    existingMember: boolean | null = null

    /// Loading value can get set inside handler by caller
    loading = false

    async goNext() {
        if (this.loading) {
            return;
        }
        if (this.existingMember === null) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "not_selected",
                message: "Maak een keuze"
            }))
            return;
        }
        this.errorBox = null
        this.handler(this.existingMember, this)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#group-selection-view {
}
</style>

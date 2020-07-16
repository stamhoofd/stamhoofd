<template>
    <div v-if="groups.length == 0" id="group-selection-view" class="st-view">
        <STNavigationBar title="Kies een groep">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">Terug</button>
        </STNavigationBar>
        
        <main>
            <h1>
                Er zijn geen beschikbare groepen voor {{ member.firstName }}
            </h1>
            <p>{{ member.firstName }} is waarschijnlijk te oud of te jong</p>

            <p class="error-box">
                Het is niet mogelijk om {{ member.firstName }} in te schrijven
            </p>
        </main>

        <STToolbar>
            <button  slot="right" class="button primary" @click="pop">
                Sluiten
            </button>
        </STToolbar>
    </div>

    <div v-else id="group-selection-view" class="st-view">
        <STNavigationBar title="Kies een groep">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">Terug</button>
        </STNavigationBar>
        
        <main>
            <h1>
                Bij welke groep wil je {{ member.firstName }} inschrijven?
            </h1>
            <p>Dit kan later gewijzigd worden indien nodig.</p>

            <STErrorsDefault :error-box="errorBox" />
            <STList>
                <STListItem v-for="group in groups" :key="parent.id" :selectable="true" element-name="label" class="right-stack left-center">
                    <Radio slot="left" @click.stop name="choose-group" />
                    <h2 class="group-name">{{ group.name }}</h2>
                    <p class="group-description" v-if="group.description">{{ group.description }}</p>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
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
import { ErrorBox, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Radio, Validator, STList, STListItem } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent, Group } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import MemberParentsView from './MemberParentsView.vue';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        Radio,
        STList,
        STListItem
    }
})
export default class MemberGroupView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberDetails // tood

    @Prop({ required: true })
    handler: (group: Group, component: MemberGroupView) => void;

    errorBox: ErrorBox | null = null

    get groups() {
        const organizization = OrganizationManager.organization
        return this.member.getMatchingGroups(organizization.groups)
    }

    async goNext() {
        const valid = false
        if (valid) {
     
            // todo: Get possible groups
           //this.handler(parent, this)
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#group-selection-view {
}
</style>

<template>
    <div v-if="groups.length == 0" id="group-selection-view" class="st-view">
        <STNavigationBar title="Kies een groep">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
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
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>
        
        <main>
            <h1>
                Bij welke groep wil je {{ member.firstName }} inschrijven?
            </h1>
            <p>Dit kan later gewijzigd worden indien nodig.</p>

            <STErrorsDefault :error-box="errorBox" />
            <STList>
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center">
                    <Radio slot="left" @click.stop name="choose-group" v-model="selectedGroup" :value="group"/>
                    <h2 class="group-name">{{ group.settings.name }}</h2>
                    <p class="group-description" v-if="group.settings.description">{{ group.settings.description }}</p>
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
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';

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
export default class MemberGroupView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberDetails // tood

    @Prop({ required: true })
    handler: (group: Group, component: MemberGroupView) => void;

    errorBox: ErrorBox | null = null

    selectedGroup = this.groups[0] ?? null

    /// Loading value can get set inside handler by caller
    loading = false

    mounted() {
        if (this.member.preferredGroupId) {
            for (const group of this.groups) {
                if (group.id === this.member.preferredGroupId) {
                    this.$set(this, "selectedGroup", group)
                }
            }
        }
    }

    get groups() {
        const organizization = OrganizationManager.organization
        return this.member.getMatchingGroups(organizization.groups)
    }

    async goNext() {
        if (this.loading) {
            return;
        }
        if (!this.selectedGroup) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "not_selected",
                message: "Kies een groep voor je verder gaat"
            }))
            return;
        }
        this.errorBox = null
        this.handler(this.selectedGroup, this)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#group-selection-view {
}
</style>

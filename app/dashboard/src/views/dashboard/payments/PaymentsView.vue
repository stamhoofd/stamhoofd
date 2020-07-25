<template>
    <div class="st-view">
        <STNavigationBar title="Overschrijvingen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>

            <template #right>
                <input v-model="searchQuery" class="input search" placeholder="Zoeken">
            </template>
        </STNavigationBar>

        <main>
            <h1>Overschrijvingen</h1>
            <p>Hier kan je de betalingen van het lidgeld opvolgen. We bekijken momenteel een mogelijkheid om dit op een betaalbare manier te automatiseren, maar hier komt veel bij kijken. Online betalingen zijn helaas erg duur, en onbetaalbaar voor veel verenigingen. Moesten jullie het toch overwegen om 39 cent per Bancontact betaling, of 20 cent per Payconiq betaling te betalen, kan je ons contacteren en kunnen we dit voor jullie activeren. Online betalingen bij feitelijke verenigingen is ook niet mogelijk.</p>

            <Spinner v-if="loading"/>
        </main>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, MaleIcon, FemaleIcon, CenteredMessage, BackButton } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings, OrganizationPatch } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditGroupView from './EditGroupView.vue';
import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        MaleIcon,
        FemaleIcon,
        BackButton
    }
})
export default class PaymentsView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    loading = false
    searchQuery = ""

    mounted() {
        this.loading = true

        // Todo: load payments
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';


</style>

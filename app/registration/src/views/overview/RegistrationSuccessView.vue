<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Hoera! X en X zijn ingeschreven</h1>
            </main>

            <STToolbar>
                <button slot="right" class="button primary" @click="close">
                    <span>Sluiten</span>
                    <span class="icon arrow-right"/>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins,  Prop } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import OverviewView from './OverviewView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
    }
})
export default class RegistrationSuccessView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    step = 4

    mounted() {
        MemberManager.loadMembers().catch(e => {
            console.error(e)
        })
    }

    close() {
        this.navigationController!.push(new ComponentWithProperties(OverviewView, {}), true, this.navigationController!.components.length, true)
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
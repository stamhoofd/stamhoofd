<template>
    <div class="boxed-view">
        <div class="st-view" >
            <main>
                Hello world
            </main>
            <STToolbar>
                <button class="primary button" slot="right">
                    <span class="icon cart"/>
                    <span>Winkelmandje</span>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin, HistoryManager } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberWithRegistrations, Group, Payment, PaymentDetailed, RegistrationWithMember, PaymentMethod } from '@stamhoofd/structures';
import { OrganizationManager } from '../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import FinancialProblemsView from './FinancialProblemsView.vue';
import { Formatter } from '@stamhoofd/utility';
import TransferPaymentView from './TransferPaymentView.vue';
import RegistrationOverviewView from './RegistrationOverviewView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
    },
    filters: {
        price: Formatter.price
    }
})
export default class WebshopView extends Mixins(NavigationMixin){


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>
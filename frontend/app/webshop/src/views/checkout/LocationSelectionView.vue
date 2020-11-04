<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Kies je afhaalmethode</h1>

                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="takeoutMethod in takeoutMethods" :key="takeoutMethod.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio slot="left" v-model="selectedLocation" name="choose-location" :value="takeoutMethod" />
                        <h2 class="style-title-list">
                            Afhalen: {{ takeoutMethod.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ takeoutMethod.description }}
                        </p>
                    </STListItem>
                </STList>
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { CheckoutMethod, Group, KeychainedResponse, MemberWithRegistrations, Payment, PaymentMethod, PaymentStatus, Record, RecordType, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

import { WebshopManager } from '../../classes/WebshopManager';
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import TimeSelectionView from './TimeSelectionView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault
    }
})
export default class LocationSelectionView extends Mixins(NavigationMixin){
    step = 2

    loading = false
    errorBox: ErrorBox | null = null
    selectedLocation: CheckoutMethod | null = null

    get webshop() {
        return WebshopManager.webshop
    }

    get takeoutMethods() {
        return this.webshop.meta.checkoutMethods
    }

    mounted() {
        this.selectedLocation = this.webshop.meta.checkoutMethods[0] ?? null
    }
    
    async goNext() {
        if (this.loading || !this.selectedLocation) {
            return
        }
        this.loading = true

        try {
           // todo

           this.show(new ComponentWithProperties(TimeSelectionView, { timeSlots: this.selectedLocation.timeSlots }))
            
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
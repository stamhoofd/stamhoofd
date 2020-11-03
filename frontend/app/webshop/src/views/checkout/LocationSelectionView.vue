<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Kies je afhaalmethode</h1>

                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="takeoutLocation in takeoutLocations" :key="takeoutLocation.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio slot="left" name="choose-location" v-model="selectedLocation" :value="takeoutLocation"/>
                        <h2 class="style-title-list">Afhalen: {{ takeoutLocation.name }}</h2>
                        <p class="style-description-small">{{ takeoutLocation.description }}</p>
                    </STListItem>
                </STList>

            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right"/>
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins,  Prop } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingButton, Radio, ErrorBox, STErrorsDefault } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberWithRegistrations, Group, RegisterMembers, RegisterMember, PaymentMethod, Payment, PaymentStatus, RegisterResponse, KeychainedResponse, RecordType, Record, SelectedGroup, WebshopTakeoutLocation } from '@stamhoofd/structures';
import { SimpleError } from '@simonbackx/simple-errors';
import { SessionManager } from '@stamhoofd/networking';
import { Decoder } from '@simonbackx/simple-encoding';
import { WebshopManager } from '../../classes/WebshopManager';

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
    selectedLocation: WebshopTakeoutLocation | null = null

    get webshop() {
        return WebshopManager.webshop
    }

    get takeoutLocations() {
        return this.webshop.meta.takeoutLocations
    }

    mounted() {
        this.selectedLocation = this.webshop.meta.takeoutLocations[0] ?? null
    }

    
    async goNext() {
        if (this.loading || !this.selectedLocation) {
            return
        }
        this.loading = true

        try {
           // todo
            
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
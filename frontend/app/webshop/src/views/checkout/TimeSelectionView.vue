<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Kies je afhaaltijdstip</h1>

                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="(slot, index) in slots" :key="index" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio slot="left" name="choose-location" v-model="selectedSlot" :value="slot"/>
                        {{ slot.date | date }}, tussen {{ slot.startTime | minutes }} - {{ slot.endTime | minutes }}
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
import { MemberWithRegistrations, Group, RegisterMembers, RegisterMember, PaymentMethod, Payment, PaymentStatus, RegisterResponse, KeychainedResponse, RecordType, Record, SelectedGroup, WebshopTakeoutLocation, WebshopTimeSlot, WebshopTimeSlots } from '@stamhoofd/structures';
import { SimpleError } from '@simonbackx/simple-errors';
import { SessionManager } from '@stamhoofd/networking';
import { Decoder } from '@simonbackx/simple-encoding';
import { WebshopManager } from '../../classes/WebshopManager';
import { Formatter } from '@stamhoofd/utility';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault
    },
    filters: {
        date: Formatter.date.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class TimeSelectionView extends Mixins(NavigationMixin){
    step = 3

    loading = false
    errorBox: ErrorBox | null = null
    selectedSlot: WebshopTimeSlot | null = null

    @Prop({})
    timeSlots: WebshopTimeSlots

    get webshop() {
        return WebshopManager.webshop
    }

    get slots() {
        return this.timeSlots.timeSlots.sort(WebshopTimeSlot.sort)
    }

    mounted() {
        this.selectedSlot = this.slots[0] ?? null
    }
    
    async goNext() {
        if (this.loading || !this.selectedSlot) {
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
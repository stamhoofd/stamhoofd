<template>
    <div class="steps-layout">
        <StepsHeader :progress="totalSteps ? ((step - 1) / totalSteps) : 0">
            <template #left>
                <slot name="left">
                    <transition name="move" mode="out-in">
                        <div v-if="step <= 1" id="logo" alt="Stamhoofd" />
                        <div v-else @click.prevent="goBack()">
                            Terug
                        </div>
                    </transition>
                </slot>
            </template>
            <template #center>
                <slot name="center">
                    <span v-if="totalSteps" class="style-caption">Stap {{ step }} / {{ totalSteps }}</span>
                </slot>
            </template>
            <template #right>
                <slot name="right" />
            </template>
        </StepsHeader>

        <main>
            <NavigationController
                ref="navigationController"
                :root="root"
                @didPop="updateProgress"
                @didPush="updateProgress"
            />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { Component, Prop,Ref,Vue } from "vue-property-decorator";

import StepsHeader from "./StepsHeader.vue";

@Component({
    components: {
        StepsHeader,
        NavigationController,
    },
})
export default class Steps extends Vue {
    step = 1;

    @Prop({ default: null })
    totalSteps!: number | null

    @Prop({ required: true })
    root!: ComponentWithProperties

    @Ref("navigationController") readonly navigationController!: NavigationController;

    goBack() {
        //this.step--;
        this.navigationController.pop().catch(e => {
            console.error(e)
        });
    }

    updateProgress() {
        this.step = this.navigationController.components.length;
    }
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/layout/steps.scss";
</style>

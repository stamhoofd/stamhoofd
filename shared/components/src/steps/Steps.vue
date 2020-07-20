<template>
    <div class="steps-layout">
        <StepsHeader :progress="totalSteps && step ? ((step - 1) / totalSteps) : 0">
            <template #left>
                <slot name="left" v-bind:step="step" v-bind:canPop="canPop">
                    <transition name="move" mode="out-in">
                        <div v-if="!canPop" id="logo" alt="Stamhoofd" />
                        <div v-else @click.prevent="goBack()">
                            Terug
                        </div>
                    </transition>
                </slot>
            </template>
            <template #center>
                <slot name="center">
                    <span v-if="totalSteps && step && step <= totalSteps" class="style-caption">Stap {{ step }} / {{ totalSteps }}</span>
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
    step = 0;

    canPop = false

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
        this.canPop = this.navigationController.components.length > 1
        this.$nextTick(() => {
            this.step = (this.navigationController.mainComponent?.componentInstance() as any)?.step ?? 0;
        })
        
    }
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles' as *;

$header-height: 70px;

.steps-layout {
    background: $color-white-shade;
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);

    @media (max-width: 800px + 50px*2) {
        background: $color-white;
    }

    > header {
        > div {
            position: fixed;
            left: 0;
            top: 0;
            right: 0;
            height: $header-height - 30px;
            display: flex;
            flex-direction: row;
            padding: 15px 15px;
            z-index: 10;

            background: $color-white-shade;

            @media (max-width: 800px + 50px*2) {
                background: $color-white;
            }

            &::before {
                content: "";
                left: 0;
                right: 0;
                top: $header-height;
                height: 50px;
                background: linear-gradient($color-white-shade, rgba($color-white-shade, 0));
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s;
                position: absolute;

                @media (max-width: 800px + 50px*2) {
                    background: linear-gradient($color-white, rgba($color-white, 0));
                }
            }

            > .progress {
                position: absolute;
                left: 0;
                top: 0;
                height: $border-width;
                pointer-events: none;
                background: $color-primary;
                border-top-right-radius: $border-width/2;
                border-bottom-right-radius: $border-width/2;
                width: 0;
                opacity: 1;
                transition: width 0.3s, opacity 0.3s;

                &.hide {
                    transition: width 0.3s, opacity 0.2s 0.3s;
                    opacity: 0;
                }
            }

            > .left {
                flex-grow: 1;
                flex-basis: 0;
                flex-shrink: 10;
                text-align: left;

                display: flex;
                align-items: center;
                justify-content: flex-start;
            }

            > .right {
                flex-grow: 1;
                flex-basis: 0;
                flex-shrink: 10;

                display: flex;
                align-items: center;
                justify-content: flex-end;
            }

            > .center {
                padding: 10px;
                flex-basis: 0;
                flex-shrink: 0;
                text-overflow: ellipsis;
                white-space: nowrap;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        }

        &[data-scrolled="true"] {
            & > div {
                &::before {
                    opacity: 1;
                }
            }
        }
    }

    > main {
        padding-top: $header-height;
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);
        box-sizing: border-box;
        --st-vertical-padding: 60px;
        padding-bottom: 30px;
    }
}

</style>

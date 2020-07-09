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
@use '~@stamhoofd/scss/base/variables' as *;

$header-height: 60px;

.steps-layout {
    background: $color-white-shade;
    height: 100vh;
    height: calc(var(--vh, 1vh) * 100);

    @media (max-width: 800px + 50px*2) {
        background: $color-white;
    }

    > header {
        > div {
            position: fixed;
            left: 0;
            top: 0;
            right: 0;
            height: $header-height - 20px;
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
        height: 100vh;
        height: calc(var(--vh, 1vh) * 100);
        box-sizing: border-box;
    }
}

</style>

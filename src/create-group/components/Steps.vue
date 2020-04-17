<template>
    <div class="steps-layout">
        <Header :progress="(step - 1) / 3">
            <template #left>
                <transition name="move" mode="out-in">
                    <a v-if="step <= 1" id="logo" href="/" alt="Stamhoofd" />
                    <div v-else @click.prevent="goBack()">
                        Terug
                    </div>
                </transition>
            </template>
            <template #center>
                <span class="style-caption">Stap {{ step }} / 3</span>
            </template>
            <template #right>
                Right
            </template>
        </Header>

        <NavigationController
            ref="navigationController"
            :root="firstStep"
            :scroll-document="true"
            @didPop="updateProgress"
            @didPush="updateProgress"
        />

        <!--<main>
            <transition
                :name="pageTransition"
                v-on:after-leave="resetScrollPosition()"
            >
                <div v-if="step == 1" key="general">
                    <GeneralStep v-on:next="goNext()"></GeneralStep>
                </div>
                <div v-if="step == 2" key="group-settings">
                    <GroupSettingsStep v-on:next="goNext()"></GroupSettingsStep>
                </div>
                <div v-if="step == 3" key="groups">
                    <GroupsStep v-on:next="goNext()"></GroupsStep>
                </div>
            </transition>
        </main>-->
    </div>
</template>

<script lang="ts">
import { Component, Vue, Ref } from "vue-property-decorator";
import Header from "./Header.vue";
import GeneralStep from "./steps/General.vue";
import NavigationController from "@/shared/components/layout/NavigationController.vue";
import { ComponentWithProperties } from "@/shared/classes/ComponentWithProperties";

@Component({
    components: {
        Header,
        NavigationController,
    },
})
export default class Steps extends Vue {
    step = 1;
    firstStep = new ComponentWithProperties(GeneralStep, {});
    @Ref("navigationController") readonly navigationController!: NavigationController;

    goBack() {
        //this.step--;
        this.navigationController.pop();
    }

    updateProgress() {
        this.step = this.navigationController.components.length;
    }
}
</script>

<style lang="scss">
@use "~scss/layout/steps.scss";
</style>

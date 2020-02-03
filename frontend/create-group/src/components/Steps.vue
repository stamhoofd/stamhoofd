<template>
    <div class="steps-layout">
        <Header :progress="(step - 1) / 3">
            <template v-slot:left>
                <transition name="move" mode="out-in">
                    <a href="/" id="logo" alt="Stamhoofd" v-if="step <= 1"></a>
                    <div v-else v-on:click.prevent="goBack()">Terug</div>
                </transition>
            </template>
            <template v-slot:center>
                <span class="style-caption">Stap {{ step }} / 3</span>
            </template>
            <template v-slot:right>
                Right
            </template>
        </Header>

        <NavigationController
            ref="navigationController"
            :root="firstStep"
            :scroll-document="true"
        ></NavigationController>

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
import { Component, Vue } from "vue-property-decorator";
import Header from "./Header.vue";
import GroupSettingsStep from "./steps/GroupSettings.vue";
import GeneralStep from "./steps/General.vue";
import GroupsStep from "./steps/Groups.vue";
import NavigationController from "stamhoofd-shared/components/layout/NavigationController.vue";
import { ComponentWithProperties } from "stamhoofd-shared/classes/ComponentWithProperties";

@Component({
    components: {
        Header,
        NavigationController
    }
})
export default class Steps extends Vue {
    step: number = 2;
    firstStep = new ComponentWithProperties(GeneralStep, {});

    goBack() {
        //this.step--;
        (this.$refs.navigationController as NavigationController).pop();
    }
}
</script>

<style lang="scss">
@use "~@shared/scss/layout/steps.scss";
</style>

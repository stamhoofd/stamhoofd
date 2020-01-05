<template>
	<div id="app" class="steps-layout">
		<header>
			<div>
                <div class="left">
                    <transition name="move" mode="out-in">
                        <a href="/" id="logo" alt="Stamhoofd" v-if="step <= 1"></a>
                        <div v-else v-on:click.prevent="goBack();">Terug</div>
                    </transition>
                </div>
				<div class="center">
                    <span class="style-caption">Stap {{ step }} / 3</span>
                </div>
				<div class="right">
                    Right
                </div>
			</div>
		</header>
		<main>
            <transition :name="pageTransition" v-on:after-leave="resetScrollPosition()" appear>
                <div v-if="step == 1" key="general"><GeneralStep v-on:next="goNext()"></GeneralStep></div>
                <div v-if="step == 2" key="group-settings"><GroupSettingsStep v-on:next="goNext()"></GroupSettingsStep></div>
            </transition>
		</main>
	</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import GeneralStep from './components/steps/General.vue';
import GroupSettingsStep from './components/steps/GroupSettings.vue';

@Component({
	components: {
        GeneralStep,
        GroupSettingsStep,
	},
})
export default class App extends Vue {
    step: number = 1;
    pageTransition: string = "right-to-left";

    goNext() {
        this.pageTransition = "right-to-left";
        this.step++;
    }

    goBack() {
        this.pageTransition = "left-to-right";
        this.step--;
    }

    resetScrollPosition() {
        window.scrollTo(0, 0);
    }
}
</script>

<style lang="scss">
@use "~@shared/scss/base/reset.scss";
@use "~@shared/scss/base/text-styles.scss";
@use "~@shared/scss/elements/body.scss"; 
@use "~@shared/scss/layout/steps.scss";
@use "~@shared/scss/components/logo.scss";

body {
	
}



</style>

<template>
	<div id="app" class="steps-layout">
		<header>
			<div>
                <div class="left">
                    <transition name="move" mode="out-in">
                        <a href="/" id="logo" alt="Stamhoofd" v-if="!showNext" v-on:click.prevent="showNext = true;"></a>
                        <div v-else v-on:click.prevent="showNext = false;">Terug</div>
                    </transition>
                </div>
				<div class="center">
                    <span class="style-caption">Stap 1 / 3</span>
                </div>
				<div class="right">
                    Right
                </div>
			</div>
		</header>
		<main>
            <GeneralStep></GeneralStep>
		</main>
	</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import GeneralStep from './components/steps/General.vue';

@Component({
	components: {
		GeneralStep,
	},
})

export default class App extends Vue {
    // Data property
    showNext: boolean = false;
}
</script>

<style lang="scss">
@use "~@shared/scss/base/reset.scss";
@use "~@shared/scss/base/text-styles.scss";
@use "~@shared/scss/elements/body.scss"; 
@use "~@shared/scss/layout/steps.scss";
@use "~@shared/scss/components/logo.scss";

body {
	background: $color-white-shade;
}



</style>

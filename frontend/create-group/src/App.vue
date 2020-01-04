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
            <article>
                <h1>Jouw vereniging aansluiten</h1>
                <p>Blablabla</p>
            </article>
		</main>
	</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import HelloWorld from './components/HelloWorld.vue';

@Component({
	components: {
		HelloWorld,
	},
})

export default class App extends Vue {
    // Data property
    showNext: boolean = false;
}
</script>

<style lang="scss">
@import "~@shared/scss/fonts.scss";
@import "~@shared/scss/text-styles.scss";
@import "~@shared/scss/body.scss";
@import "~@shared/scss/layout/steps.scss";
@import "~@shared/scss/components/logo.scss";

body {
	background: $color-white-shade;
}



</style>

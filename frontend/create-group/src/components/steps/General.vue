<template>
    <article>
        <h1>Jouw vereniging aansluiten</h1>

        <div class="split-inputs">
            <div>
                <label class="style-label" for="organization-name">Naam van je vereniging</label>
                <input class="input" type="text" placeholder="De naam van je vereniging" autocomplete="organization" id="organization-name" ref="firstInput">

                <label class="style-label" for="organization-count">Hoeveel leden hebben jullie ongeveer?</label>
                <Slider></Slider>
            </div>

            <div>
                <label class="style-label">Adres van je vereniging</label>
                <input class="input" type="text" placeholder="Straat en number" autocomplete="address-line1">
                <div class="input-group">
                    <div>
                        <input class="input" type="text" placeholder="Postcode" autocomplete="postal-code">
                    </div>
                    <div>
                        <input class="input" type="text" placeholder="Gemeente" autocomplete="city">
                    </div>
                </div>

                <select class="input">
                    <option>België</option>
                    <option>Nederland</option>
                </select>
                
            </div>
           
        </div>

        <button class="button primary" v-on:click="$emit('next')" id="next-button">Verder</button>
        
    </article>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import Slider from '@shared/components/inputs/Slider.vue';

@Component({
  // All component options are allowed in here
  components: {
      Slider
  }
})
export default class General extends Vue {
    mounted() {
        // Focus first input automatically
        let input = this.$refs.firstInput as HTMLElement;
        input.focus();
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
    // This should be @use, but this won't work with webpack for an unknown reason? #bullshit
    @use '~@shared/scss/layout/split-inputs.scss';
    @use '~@shared/scss/base/text-styles.scss';
    @use '~@shared/scss/components/inputs.scss';
    @use '~@shared/scss/components/buttons.scss';

    h1 {
        @extend .style-title-1;
        margin-bottom: 20px;
    }

    #next-button {
        margin-top: 30px;
    }
</style>

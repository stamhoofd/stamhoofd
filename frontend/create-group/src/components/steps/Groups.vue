<template>
    <article>
        <h1>Groepindeling</h1>
        <p>Om je wat werk te besparen hebben we een voorstel gemaakt als groepindeling. Je kan nu wijzigingen maken, maar je kan deze op elk moment nog wijzigen.</p>

        <h2 class="style-label">Leden</h2>


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
export default class Groups extends Vue {
   
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

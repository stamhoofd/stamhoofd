<template>
    <article>
        <h1>Groepindeling</h1>
        <p>Om je wat werk te besparen hebben we een voorstel gemaakt als groepindeling. Selecteer de groepen die je wilt toevoegen. Je kan nu wijzigingen maken, maar je kan alles op elk moment nog wijzigen.</p>

        <h2 class="style-label">Leden</h2>
        <CheckboxList>
            <CheckboxItem>
                <template v-slot:left>Kapoenen</template>
                <template v-slot:right>
                    6 - 8 jaar
                    <GenderSelector></GenderSelector>
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template v-slot:left>Welpen</template>
                <template v-slot:right></template>
            </CheckboxItem>
            <CheckboxItem>
                <template v-slot:left>Kabouters</template>
                <template v-slot:right></template>
            </CheckboxItem>
            <CheckboxItem>
                <template v-slot:left>Jongverkenners</template>
                <template v-slot:right></template>
            </CheckboxItem>
            <CheckboxItem>
                <template v-slot:left>Jonggidsen</template>
                <template v-slot:right></template>
            </CheckboxItem>
        </CheckboxList>


        <button class="button primary" v-on:click="$emit('next')" id="next-button">Verder</button>
    </article>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import Slider from '@shared/components/inputs/Slider.vue';
import CheckboxList from '@shared/components/inputs/CheckboxList.vue';
import CheckboxItem from '@shared/components/inputs/CheckboxItem.vue';
import GenderSelector from '@shared/components/inputs/GenderSelector.vue';

@Component({
  // All component options are allowed in here
  components: {
      Slider,
      CheckboxList,
      CheckboxItem,
      GenderSelector
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

    p {
        @extend .style-description;
        margin: 10px 0;
    }

    #next-button {
        margin-top: 30px;
    }
</style>

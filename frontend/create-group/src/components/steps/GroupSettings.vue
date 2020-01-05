<template>
    <article>
        <h1>Inschrijven & groepen</h1>

        <div class="split-inputs">
            <div>
                <label class="style-label" for="organization-name">Soort vereniging</label>
                <select class="input" ref="firstInput">
                    <option>Scoutsgroep</option>
                    <option>Chirogroep</option>
                </select>
            </div>

            <div>
                <label class="style-label" for="organization-name">Koepelorganisatie</label>
                <select class="input">
                    <option>Scouts & Gidsen Vlaanderen</option>
                    <option>FOS</option>
                </select>
                
            </div>
        </div>
        
        <label class="style-label">Jongens en meisjes</label>
        <RadioGroup>
            <Radio>Gemengd</Radio>
            <Radio>Gescheiden</Radio>
            <Radio>Enkel jongens</Radio>
            <Radio>Enkel meisjes</Radio>
        </RadioGroup>


        <label class="style-label">Test</label>
        <Checkbox>Verminder het lidgeld voor leden met financiële moeilijkheden Verminder het lidgeld voor leden met financiële moeilijkheden</Checkbox>

        <button class="button primary">Verder</button>
        
    </article>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import Slider from '@shared/components/inputs/Slider.vue';
import Checkbox from '@shared/components/inputs/Checkbox.vue';
import Radio from '@shared/components/inputs/Radio.vue';
import RadioGroup from '@shared/components/inputs/RadioGroup.vue';

@Component({
  // All component options are allowed in here
  components: {
      Slider,
      Checkbox,
      Radio,
      RadioGroup
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
        margin-bottom: 40px;
    }
</style>

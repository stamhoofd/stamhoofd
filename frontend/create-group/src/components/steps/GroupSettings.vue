<template>
    <article>
        <h1>Inschrijven & groepen</h1>

        <hr>
        <h2>Samenstelling</h2>

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


        <label class="style-label">Extra onderverdelingen</label>
        <Checkbox>Woutlopers</Checkbox>

        <hr>
        <h2>Werkjaar</h2>

        <div class="split-inputs">
            <div>
                <label class="style-label" for="organization-name">Start werkjaar</label>
                <select class="input">
                    <option v-for="(month, index) in months" :value="index" :key="index">{{ month }}</option>
                </select>
            </div>

            <div>
                <label class="style-label" for="organization-name">Inschrijvingsperiode</label>
                <div class="mixed-input">
                    <select>
                        <option v-for="(month, index) in months" :value="index" :key="index">{{ month }}</option>
                    </select>
                    <span>tot</span>
                    <select>
                        <option v-for="(month, index) in months" :value="index" :key="index">{{ month }}</option>
                    </select>
                </div>
            </div>
           
        </div>

        <hr>
        <h2>Prijzen</h2>
        <p>Je kan uitzonderingen voor bepaalde groepen toevoegen in de volgende stap.</p>

        <div class="split-inputs">
            <div>
                <label class="style-label">Lidgeld</label>
                <PriceInput></PriceInput>
            </div>

            <div>
                <label class="style-label">Lidgeld voor beheerders</label>
                <PriceInput></PriceInput>
            </div>
        </div>

        <Checkbox>Verminder het lidgeld voor leden met financiële moeilijkheden</Checkbox>

        <label class="style-label">Verminderd lidgeld</label>
        <PriceInput></PriceInput>

        <button class="button primary" v-on:click="$emit('next')" id="next-button">Verder</button>
        
    </article>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import Slider from '@shared/components/inputs/Slider.vue';
import Checkbox from '@shared/components/inputs/Checkbox.vue';
import Radio from '@shared/components/inputs/Radio.vue';
import RadioGroup from '@shared/components/inputs/RadioGroup.vue';
import PriceInput from '@shared/components/inputs/PriceInput.vue';

@Component({
  // All component options are allowed in here
  components: {
      Slider,
      Checkbox,
      Radio,
      RadioGroup,
      PriceInput
  }
})
export default class General extends Vue {
    months: string[] = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"];

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
    @use '~@shared/scss/components/mixed-input.scss';
    @use '~@shared/scss/components/buttons.scss';
    @use '~@shared/scss/elements/hr.scss';

    h1 {
        @extend .style-title-1;
        margin-bottom: 20px;
    }

    p {
        @extend .style-description;
        margin: 10px 0;
    }

    h2 {
        @extend .style-title-2;
        margin-bottom: 20px;
    }

    hr {
        @extend .hr;
        margin-top: 40px;
    }

    #next-button {
        margin-top: 30px;
    }
</style>

<template>
    <article>
        <h1>Jouw vereniging aansluiten</h1>

        <div class="split-inputs">
            <div>
                <label class="style-label">Naam van je vereniging</label>
                <input type="text" placeholder="De naam van je vereniging" autocomplete="organization">
            </div>

            <div>
                <label class="style-label">Adres van je vereniging</label>
                <input type="text" placeholder="Straat en number" autocomplete="address-line1">
                <input type="text" placeholder="Postcode" autocomplete="postal-code">
                <input type="text" placeholder="Gemeente" autocomplete="city">
                
            </div>
           
        </div>
        
    </article>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class General extends Vue {
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
    // This should be @use, but this won't work with webpack for an unknown reason? #bullshit
    @use '~@shared/scss/layout/split-inputs.scss';

    
</style>

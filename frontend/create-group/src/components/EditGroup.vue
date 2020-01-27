<template>
    <div style="padding: 40px 40px;">
        <h1>Nieuwe groep toevoegen</h1>
        <SegmentedControl :items="tabs" v-model="tab"></SegmentedControl>

        <button class="button primary" v-on:click="$emit('dismiss')" id="save-button">Opslaan</button>
    </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'

import SegmentedControl from '@shared/components/inputs/SegmentedControl.vue';

@Component({
  props: {
      text: String
  },
  components: {
      SegmentedControl,
  }
})
export default class EditGroup extends Vue {
    tabs = ["Algemeen", "Inschrijven", "Toegang", "Test"]
    tab = this.tabs[0]
}
</script>

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

    #save-button {
        margin-top: 30px;
    }
</style>
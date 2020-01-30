<template>
    <div style="padding: 40px 40px;">
        <button @click="back">
            Sluiten
        </button>
        <h1>Nieuwe groep toevoegen</h1>
        <SegmentedControl :items="tabs" v-model="tab"></SegmentedControl>
        <p>{{ tab }}</p>

        <label class="style-label" for="group-name">Naam van de groep</label>
        <input
            class="input"
            type="text"
            placeholder="De naam van de groep"
            id="group-name"
            ref="firstInput"
        />

        <label class="style-label" for="group-description">Beschrijving</label>
        <textarea
            class="input"
            id="group-description"
            placeholder="Zichtbaar voor leden bij het inschrijven"
        ></textarea>

        <button class="button primary" v-on:click="next" id="save-button">
            Volgende
        </button>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";

import SegmentedControl from "@shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "stamhoofd-shared/classes/ComponentWithProperties";
import EditGroupDetail from "./EditGroupDetail.vue";

@Component({
    props: {
        text: String
    },
    components: {
        SegmentedControl
    }
})
export default class EditGroup extends Vue {
    tabs = ["Algemeen", "Inschrijven", "Toegang", "Test"];
    tab = this.tabs[0];

    next() {
        this.$emit(
            "push",
            new ComponentWithProperties(EditGroupDetail, { text: "test" })
        );
    }

    back() {
        this.$emit("pop");
    }
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

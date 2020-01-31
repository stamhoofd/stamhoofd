<template>
    <div style="padding: 40px 40px;">
        <button @click="back">Terug</button>
        <h1>Nieuwe groep toevoegen</h1>
        <SegmentedControl :items="tabs" v-model="tab"></SegmentedControl>

        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>
        <p>Dit is een test!</p>

        <button class="button primary" v-on:click="next" id="save-button">
            Volgende
        </button>
        <button @click="back">Terug</button>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";

import SegmentedControl from "@shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "stamhoofd-shared/classes/ComponentWithProperties";
import EditGroup from "./EditGroup.vue";

@Component({
    props: {
        text: String
    },
    components: {
        SegmentedControl
    }
})
export default class EditGroupDetail extends Vue {
    tabs = ["Algemeen", "Inschrijven", "Toegang", "Test"];
    tab = this.tabs[1];

    next() {
        this.$emit(
            "push",
            new ComponentWithProperties(EditGroup, { text: "test" })
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

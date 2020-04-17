<template>
    <div style="padding: 40px 40px;">
        <button @click="back">
            Terug
        </button>
        <h1>Nieuwe groep toevoegen</h1>
        <SegmentedControl v-model="tab" :items="tabs" />

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

        <label class="style-label" for="group-description">Beschrijving</label>
        <textarea id="group-description" class="input" placeholder="Zichtbaar voor leden bij het inschrijven" />

        <p>Dit is een test!</p>

        <button id="save-button" class="button primary" @click="next">
            Volgende
        </button>
        <button @click="back">
            Terug
        </button>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";

import SegmentedControl from "@/shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "@/shared/classes/ComponentWithProperties";
import EditGroup from "./EditGroup.vue";

@Component({
    props: {
        text: String,
    },
    components: {
        SegmentedControl,
    },
})
export default class EditGroupDetail extends Vue {
    tabs = ["Algemeen", "Inschrijven", "Toegang", "Test"];
    tab = this.tabs[1];

    next() {
        this.$emit("push", new ComponentWithProperties(EditGroup, { text: "test" }));
    }

    back() {
        this.$emit("pop");
    }

    destroyed() {
        console.log("EditGroupDetail destroyed");
    }
}
</script>

<style scoped lang="scss">
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';

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

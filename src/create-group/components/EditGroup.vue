<template>
    <div style="padding: 40px 40px;">
        <button @click="back">
            Sluiten
        </button>
        <h1>Nieuwe groep toevoegen</h1>
        <SegmentedControl v-model="tab" :items="tabs" />
        <p>{{ tab }}</p>

        <label class="style-label" for="group-name">Naam van de groep</label>
        <input id="group-name" ref="firstInput" class="input" type="text" placeholder="De naam van de groep">

        <label class="style-label" for="group-description">Beschrijving</label>
        <textarea id="group-description" class="input" placeholder="Zichtbaar voor leden bij het inschrijven" />

        <button id="save-button" class="button primary" @click="next">
            Volgende
        </button>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";

import SegmentedControl from "@/shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "@/shared/classes/ComponentWithProperties";
import EditGroupDetail from "./EditGroupDetail.vue";

@Component({
    props: {
        text: String,
    },
    components: {
        SegmentedControl,
    },
})
export default class EditGroup extends Vue {
    tabs = ["Algemeen", "Inschrijven", "Toegang", "Test"];
    tab = this.tabs[0];

    next() {
        this.$emit("push", new ComponentWithProperties(EditGroupDetail, { text: "test" }));
    }

    back() {
        this.$emit("pop");
    }

    destroyed() {
        console.log("EditGroup destroyed");
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

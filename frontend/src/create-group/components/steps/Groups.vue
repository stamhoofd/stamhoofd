<template>
    <Step>
        <h1>Groepindeling</h1>
        <p>
            Om je wat werk te besparen hebben we een voorstel gemaakt als groepindeling. Selecteer de groepen die je
            wilt toevoegen. Je kan nu wijzigingen maken, maar je kan alles op elk moment nog wijzigen.
        </p>

        <h2 class="style-label" v-on:click="editGroup()">Leden</h2>
        <CheckboxList>
            <CheckboxItem>
                <template v-slot:left>Kapoenen</template>
                <template v-slot:right>
                    6 - 8 jaar
                </template>

                <template v-slot:buttons>
                    <GenderSelector></GenderSelector>
                    <MoreButton></MoreButton>
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template v-slot:left>Welpen</template>
                <template v-slot:right>
                    6 - 8 jaar
                </template>

                <template v-slot:buttons>
                    <GenderSelector></GenderSelector>
                    <MoreButton></MoreButton>
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template v-slot:left>Kaboutersmeteenhelelangenaamhierzo</template>
                <template v-slot:right>
                    6 - 8 jaar
                </template>

                <template v-slot:buttons>
                    <GenderSelector></GenderSelector>
                    <MoreButton></MoreButton>
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template v-slot:left>Jongverkenners en nog wat tekst hierzo, om te testen</template>
                <template v-slot:right>
                    6 - 8 jaar
                </template>

                <template v-slot:buttons>
                    <GenderSelector></GenderSelector>
                    <MoreButton></MoreButton>
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template v-slot:left>Jonggidsen</template>
                <template v-slot:right>
                    6 - 8 jaar
                </template>

                <template v-slot:buttons>
                    <GenderSelector></GenderSelector>
                    <MoreButton></MoreButton>
                </template>
            </CheckboxItem>
        </CheckboxList>

        <button class="button primary" v-on:click="$emit('next')" id="next-button">
            Verder
        </button>
    </Step>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";
import Slider from "stamhoofd-shared/components/inputs/Slider.vue";
import CheckboxList from "stamhoofd-shared/components/inputs/CheckboxList.vue";
import CheckboxItem from "stamhoofd-shared/components/inputs/CheckboxItem.vue";
import GenderSelector from "stamhoofd-shared/components/inputs/GenderSelector.vue";
import MoreButton from "stamhoofd-shared/components/buttons/MoreButton.vue";
import { eventBus } from "stamhoofd-shared/classes/event-bus/EventBus";
import { PresentComponentEvent } from "stamhoofd-shared/classes/PresentComponentEvent";
import EditGroup from "../EditGroup.vue";
import { ComponentWithProperties } from "stamhoofd-shared/classes/ComponentWithProperties";
import NavigationController from "stamhoofd-shared/components/layout/NavigationController.vue";
import Step from "../Step.vue";

@Component({
    // All component options are allowed in here
    components: {
        Slider,
        Step,
        CheckboxList,
        CheckboxItem,
        GenderSelector,
        MoreButton
    }
})
export default class Groups extends Vue {
    editGroup() {
        eventBus.send(
            "show-modal",
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(EditGroup, {
                    text: "Custom text"
                })
            })
        );
    }
}
</script>

<style scoped lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
@use 'scss/layout/split-inputs.scss';
@use 'scss/base/text-styles.scss';
@use 'scss/components/inputs.scss';
@use 'scss/components/buttons.scss';

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

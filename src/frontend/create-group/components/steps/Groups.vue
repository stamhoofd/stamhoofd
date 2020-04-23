<template>
    <Step>
        <h1>Groepindeling</h1>
        <p>
            Om je wat werk te besparen hebben we een voorstel gemaakt als groepindeling. Selecteer de groepen die je
            wilt toevoegen. Je kan nu wijzigingen maken, maar je kan alles op elk moment nog wijzigen.
        </p>

        <h2 class="style-label" @click="editGroup()">
            Leden
        </h2>
        <CheckboxList>
            <CheckboxItem>
                <template #left>
                    Kapoenen
                </template>
                <template #right>
                    6 - 8 jaar
                </template>

                <template #buttons>
                    <GenderSelector />
                    <MoreButton />
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template #left>
                    Welpen
                </template>
                <template #right>
                    6 - 8 jaar
                </template>

                <template #buttons>
                    <GenderSelector />
                    <MoreButton />
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template #left>
                    Kaboutersmeteenhelelangenaamhierzo
                </template>
                <template #right>
                    6 - 8 jaar
                </template>

                <template #buttons>
                    <GenderSelector />
                    <MoreButton />
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template #left>
                    Jongverkenners en nog wat tekst hierzo, om te testen
                </template>
                <template #right>
                    6 - 8 jaar
                </template>

                <template #buttons>
                    <GenderSelector />
                    <MoreButton />
                </template>
            </CheckboxItem>
            <CheckboxItem>
                <template #left>
                    Jonggidsen
                </template>
                <template #right>
                    6 - 8 jaar
                </template>

                <template #buttons>
                    <GenderSelector />
                    <MoreButton />
                </template>
            </CheckboxItem>
        </CheckboxList>

        <button id="next-button" class="button primary" @click="$emit('next')">
            Verder
        </button>
    </Step>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import { eventBus } from "@stamhoofd/shared/classes/event-bus/EventBus";
import MoreButton from "@stamhoofd/shared/components/buttons/MoreButton.vue";
import CheckboxItem from "@stamhoofd/shared/components/inputs/CheckboxItem.vue";
import CheckboxList from "@stamhoofd/shared/components/inputs/CheckboxList.vue";
import GenderSelector from "@stamhoofd/shared/components/inputs/GenderSelector.vue";
import Slider from "@stamhoofd/shared/components/inputs/Slider.vue";
import NavigationController from "@stamhoofd/shared/components/layout/NavigationController.vue";
import Vue from "vue";
import Component from "vue-class-component";

import EditGroup from "../EditGroup.vue";
import Step from "../Step.vue";

@Component({
    // All component options are allowed in here
    components: {
        Slider,
        Step,
        CheckboxList,
        CheckboxItem,
        GenderSelector,
        MoreButton,
    },
})
export default class Groups extends Vue {
    editGroup() {
        eventBus.send(
            "present",
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(EditGroup, {
                    text: "Custom text",
                }),
            })
        );
    }
}
</script>

<style scoped lang="scss">
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

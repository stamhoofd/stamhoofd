<template>
    <Step>
        <h1>Jouw vereniging aansluiten</h1>

        <div class="split-inputs">
            <div>
                <label class="style-label" for="organization-name">Naam van je vereniging</label>
                <input
                    id="organization-name"
                    ref="firstInput"
                    class="input"
                    type="text"
                    placeholder="De naam van je vereniging"
                    autocomplete="organization"
                >

                <label class="style-label" for="organization-count">Hoeveel leden hebben jullie ongeveer?</label>
                <Slider />
            </div>

            <div>
                <label class="style-label">Adres van je vereniging</label>
                <input class="input" type="text" placeholder="Straat en number" autocomplete="address-line1">
                <div class="input-group">
                    <div>
                        <input class="input" type="text" placeholder="Postcode" autocomplete="postal-code">
                    </div>
                    <div>
                        <input class="input" type="text" placeholder="Gemeente" autocomplete="city">
                    </div>
                </div>

                <select class="input">
                    <option>België</option>
                    <option>Nederland</option>
                </select>
            </div>
        </div>

        <button id="next-button" class="button primary" @click="next">
            Verder
        </button>
        <button class="button secundary" @click="editGroup">
            Test
        </button>
    </Step>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import { eventBus } from "@stamhoofd/shared/classes/event-bus/EventBus";
import Slider from "@stamhoofd/shared/components/inputs/Slider.vue";
import NavigationController from "@stamhoofd/shared/components/layout/NavigationController.vue";
import Popup from "@stamhoofd/shared/components/layout/Popup.vue";
import { Component, Vue } from "vue-property-decorator";

import EditGroupDetail from "../EditGroupDetail.vue";
import Step from "../Step.vue";
import GroupSettings from "./GroupSettings.vue";

@Component({
    // All component options are allowed in here
    components: {
        Slider,
        Step,
    },
})
export default class General extends Vue {
    mounted() {
        // Focus first input automatically
        const input = this.$refs.firstInput as HTMLElement;
        input.focus();
    }
    editGroup() {
        eventBus.send(
            "show",
            new ComponentWithProperties(Popup, {
                root: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EditGroupDetail, {
                        text: "Custom text",
                    }),
                }),
            })
        );
    }

    next() {
        this.$emit("push", new ComponentWithProperties(GroupSettings, {}));
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';

h1 {
    @extend .style-title-1;
    margin-bottom: 20px;
}

#next-button {
    margin-top: 30px;
}
</style>

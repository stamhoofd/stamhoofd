<template>
    <div>
        <STList>
            <STListItem v-for="choice of choices" :key="choice.id" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :modelValue="isChoiceSelected(choice)" @update:modelValue="setChoiceSelected(choice, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ choice.name }}
                </h3>
                <p v-if="choice.description" class="style-description-small">
                    {{ choice.description }}
                </p>
            </STListItem>
        </STList>
    </div>
</template>


<script lang="ts">
import { ChoicesFilter,ChoicesFilterChoice } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "@simonbackx/vue-app-navigation/classes";

import Checkbox from "../../inputs/Checkbox.vue";
import STList from "../../layout/STList.vue";
import STListItem from "../../layout/STListItem.vue";

@Component({
    components: {
        STListItem,
        STList,
        Checkbox
    }
})
export default class ChoicesFilterView extends Vue {
    @Prop({ required: true }) 
        filter: ChoicesFilter<any>

    get choices() {
        return this.filter.definition.choices
    }

    isChoiceSelected(choice: ChoicesFilterChoice) {
        return !!this.filter.choiceIds.find(id => id === choice.id)
    }

    setChoiceSelected(choice: ChoicesFilterChoice, selected: boolean) {
        if (selected === this.isChoiceSelected(choice)) {
            return
        }
        if (!selected) {
            const index = this.filter.choiceIds.findIndex(id => id === choice.id)
            if (index != -1) {
                this.filter.choiceIds.splice(index, 1)
            }
        } else {
            this.filter.choiceIds.push(choice.id)
        }
    }

}
</script>
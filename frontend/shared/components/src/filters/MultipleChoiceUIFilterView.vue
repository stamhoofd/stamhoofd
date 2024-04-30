<template>
    <STList>
        <STListItem v-for="option of options" :key="option.id" :selectable="true" element-name="label">
            <template #left>
                <Checkbox :modelValue="isOptionSelected(option)" @update:modelValue="setOptionSelected(option, $event)" />
            </template>
            <h3 class="style-title-list">
                {{ option.name }}
            </h3>
            <p v-if="option.description" class="style-description-small">
                {{ option.description }}
            </p>
        </STListItem>
    </STList>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import Checkbox from "../inputs/Checkbox.vue";
import STList from "../layout/STList.vue";
import STListItem from "../layout/STListItem.vue";
import { MultipleChoiceUIFilter, MultipleChoiceUIFilterOption } from './MultipleChoiceUIFilter';

@Component({
    components: {
        STListItem,
        STList,
        Checkbox,
    }
})
export default class MultipleChoiceUIFilterView extends Mixins(NavigationMixin) {
    @Prop({ required: true }) 
        filter: MultipleChoiceUIFilter

    get options() {
        return this.filter.builder.options
    }

    isOptionSelected(option: MultipleChoiceUIFilterOption) {
        return !!this.filter.options.find(i => i.name === option.name)
    }

    setOptionSelected(option: MultipleChoiceUIFilterOption, selected: boolean) {
        if (selected === this.isOptionSelected(option)) {
            return
        }
        if (!selected) {
            const index = this.filter.options.findIndex(i => i.name === option.name)
            if (index != -1) {
                this.filter.options.splice(index, 1)
            }
        } else {
            this.filter.options.push(option)
        }
    }

}
</script>
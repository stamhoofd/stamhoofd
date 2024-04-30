<template>
    <div>
        <Dropdown v-model="mode">
            <option :value="RegistrationsFilterMode.Or">
                Minstens één van de geselecteerden
            </option>
            <option :value="RegistrationsFilterMode.And">
                Alle geselecteerden
            </option>
            <option :value="RegistrationsFilterMode.Nor">
                Ingeschreven voor geen van
            </option>
            <option :value="RegistrationsFilterMode.Nand">
                Niet ingeschreven voor minstens één van
            </option>
        </Dropdown>
        <STList>
            <STListItem v-for="choice of choices" :key="choice.id" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :checked="isChoiceSelected(choice)" @change="setChoiceSelected(choice, $event)" />
                </template>
                <p>
                    {{ choice.name }}
                </p>
            </STListItem>
        </STList>
    </div>
</template>


<script lang="ts">
import { Organization, RegistrationsFilter,RegistrationsFilterChoice, RegistrationsFilterMode } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "@simonbackx/vue-app-navigation/classes";

import Checkbox from "../../inputs/Checkbox.vue";
import Dropdown from "../../inputs/Dropdown.vue";
import STList from "../../layout/STList.vue";
import STListItem from "../../layout/STListItem.vue";

@Component({
    components: {
        STListItem,
        STList,
        Checkbox,
        Dropdown
    }
})
export default class RegistrationsFilterView extends Vue {
    @Prop({ required: true }) 
        filter: RegistrationsFilter<any>

    @Prop({ required: true }) 
        organization: Organization

    get RegistrationsFilterMode() {
        return RegistrationsFilterMode
    }

    get mode() {
        return this.filter.mode
    }

    set mode(mode: RegistrationsFilterMode) {
        this.filter.mode = mode
    }

    get choices() {
        return this.filter.definition.getChoices(this.organization)
    }

    isChoiceSelected(choice: RegistrationsFilterChoice) {
        return !!this.filter.choices.find(c => c.id === choice.id)
    }

    setChoiceSelected(choice: RegistrationsFilterChoice, selected: boolean) {
        if (selected === this.isChoiceSelected(choice)) {
            return
        }
        if (!selected) {
            const index = this.filter.choices.findIndex(c => c.id === choice.id)
            if (index != -1) {
                this.filter.choices.splice(index, 1)
            }
        } else {
            this.filter.choices.push(choice)
        }
    }

}
</script>
<template>
    <div>
        <Dropdown v-model="mode">
            <option :value="RegistrationsFilterMode.Or">
                Minstens één van de geselecteerde
            </option>
            <option :value="RegistrationsFilterMode.And">
                Alle geselecteerde
            </option>
            <option :value="RegistrationsFilterMode.Nor">
               Geen geselecteerde
            </option>
        </Dropdown>
        <STList>
            <STListItem v-for="choice of choices" :key="choice.id" :selectable="true" element-name="label">
                <Checkbox slot="left" :checked="isChoiceSelected(choice)" @change="setChoiceSelected(choice, $event)" />
                <p>
                    {{ choice.name }}
                </p>
            </STListItem>
        </STList>
    </div>
</template>


<script lang="ts">
import { Checkbox, Dropdown,STList, STListItem } from "@stamhoofd/components"
import { Organization, RegistrationsFilter,RegistrationsFilterChoice, RegistrationsFilterMode } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "vue-property-decorator";

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

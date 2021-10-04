<template>
    <STList>
        <STListItem :selectable="true" element-name="label">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Contains" />
            <p>Bevat...</p>
            <input v-if="filter.mode === StringFilterMode.Contains" v-model="filter.value" placeholder="Vul tekst in" class="input">
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotContains" />
            <p>Bevat niet...</p>
            <input v-if="filter.mode === StringFilterMode.NotContains" v-model="filter.value" placeholder="Vul tekst in" class="input">
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Equals" />
            <p>Is gelijk aan...</p>
            <input v-if="filter.mode === StringFilterMode.Equals" v-model="filter.value" placeholder="Vul tekst in" class="input">
        </STListItem>
    </STList>
</template>


<script lang="ts">
import { Radio, STList, STListItem } from "@stamhoofd/components"
import { StringFilter, StringFilterMode } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({
    components: {
        STListItem,
        STList,
        Radio
    }
})
export default class StringFilterView extends Vue {
    @Prop({ required: true }) 
    filter: StringFilter<any>

    get StringFilterMode() {
        return StringFilterMode
    }

}
</script>
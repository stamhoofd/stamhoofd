<template>
    <div class="property-filter-value-input">
        <STInputBox title="Wanneer ingeschakeld?" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isAlwaysEnabled()" :value="true" @update:model-value="setAlwaysEnabled()" />
                    </template>
                    <h3 class="style-title-list">
                        Altijd
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isAlwaysEnabled()" :value="false" @update:model-value="setEnabledWhen(true)" />
                    </template>
                    <h3 class="style-title-list">
                        Als...
                    </h3>
                    <p class="style-description-small">
                        {{ enabledText }}
                    </p>
                    <button v-if="!isAlwaysEnabled()" slot="right" class="button text" type="button" @click="setEnabledWhen(false)">
                        <span class="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox v-if="allowOptional" title="Wanneer verplicht invullen?*" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isAlwaysRequired()" :value="true" @update:model-value="setAlwaysRequired()" />
                    </template>
                    <h3 class="style-title-list">
                        Stap kan niet worden overgeslagen
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isNeverRequired()" :value="true" @update:model-value="setNeverRequired()" />
                    </template>
                    <h3 class="style-title-list">
                        Stap kan altijd worden overgeslagen
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="!isAlwaysRequired() && !isNeverRequired()" :value="true" @update:model-value="setRequiredWhen(true)" />
                    </template>
                    <h3 class="style-title-list">
                        Als...
                    </h3>
                    <p class="style-description-small">
                        {{ requiredText }}
                    </p>
                    <button v-if="!isAlwaysRequired() && !isNeverRequired()" slot="right" class="button text" type="button" @click="setRequiredWhen(false)">
                        <span class="icon edit" />
                        <span class="hide-small">Wijzig</span>
                    </button>
                </STListItem>
            </STList>
        </STInputBox>
        <p v-if="allowOptional" class="style-description-small">
            * Als een vragenlijst niet verplicht is, zal men de stap kunnen overslaan zolang nog niets werd ingevuld. Meestal is het niet nodig om dit te gebruiken. Als de vragenlijst altijd verplicht is om in te vullen, kan je ook nog steeds optionele vragen in die lijst hebben. Meestal is het gewoon duidelijker om optionele vragen te gebruiken. Maar soms wil je bijvoorbeeld 'alles invullen' of 'niets invullen', dan kan je dit best gebruiken.
        </p>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { FilterDefinition, FilterGroup, Organization, PropertyFilter } from '@stamhoofd/structures';
import { Component, Mixins, Prop, Watch } from "@simonbackx/vue-app-navigation/classes";
import Radio from "../../inputs/Radio.vue";
import STList from "../../layout/STList.vue";
import STListItem from "../../layout/STListItem.vue";
import FilterEditor from './FilterEditor.vue';
import STInputBox from "../../inputs/STInputBox.vue";

@Component({
    components: {
        STInputBox,
        STList,
        STListItem,
        Radio
    }
})
export default class PropertyFilterInput extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        value: PropertyFilter<any>

    @Prop({ default: true })
        allowOptional: boolean

    @Prop({ required: true })
        organization: Organization

    @Prop({ required: true })
        definitions!: FilterDefinition[]

    cachedRequiredFilter: FilterGroup<any> | null = null
    cachedEnabledFilter: FilterGroup<any> = new FilterGroup(this.definitions) // need a value to keep this reactive

    created() {
        this.onConfigurationChange()
    }

    @Watch('value')
    onConfigurationChange() {
        if (this.value.requiredWhen) {
            try {
                this.cachedRequiredFilter = this.value.requiredWhen.decode(this.definitions)
            } catch (e) {
                console.error('Error decoding required filter', e)
                this.cachedRequiredFilter = null
            }
        } else {
            this.cachedRequiredFilter = null
        }

        try {
            this.cachedEnabledFilter = this.value.enabledWhen.decode(this.definitions)
        } catch (e) {
            console.error('Error decoding required filter', e)
            this.cachedEnabledFilter = new FilterGroup(this.definitions)
        }
        console.log('onConfigurationChange', this.value, this.cachedEnabledFilter, this.cachedRequiredFilter)
    }

    isAlwaysEnabled() {
        return this.cachedEnabledFilter.filters.length == 0
    }

    isAlwaysRequired() {
        return this.cachedRequiredFilter && this.cachedRequiredFilter.filters.length == 0
    }

    isNeverRequired() {
        return this.value.requiredWhen === null
    }

    setAlwaysEnabled() {
        this.$emit('update:modelValue', 
            new PropertyFilter<any>(
                new FilterGroup(this.definitions).encoded,
                this.value.requiredWhen
            )
        )
    }

    setEnabledWhen(useCache = false) {
        this.present(new ComponentWithProperties(FilterEditor, {
            title: "Vragen als...",
            selectedFilter: this.cachedEnabledFilter,
            organization: this.organization,
            setFilter: (enabledWhen: FilterGroup<any>) => {
                this.$emit('update:modelValue', 
                    new PropertyFilter<any>(
                        enabledWhen.encoded,
                        this.value.requiredWhen
                    )
                )
            },
            definitions: this.definitions
        }).setDisplayStyle("popup"))
    }

    setAlwaysRequired() {
        this.$emit('update:modelValue', 
            new PropertyFilter<any>(
                this.value.enabledWhen,
                new FilterGroup(this.definitions).encoded
            )
        )
    }

    setNeverRequired() {
        this.$emit('update:modelValue', 
            new PropertyFilter<any>(
                this.value.enabledWhen,
                null
            )
        )
    }

    setRequiredWhen(useCache = false) {
        if (useCache && this.cachedRequiredFilter) {
            this.$emit('update:modelValue', 
                new PropertyFilter<any>(
                    this.value.enabledWhen,
                    this.cachedRequiredFilter.encoded
                )
            )
            return
        }
        this.present(new ComponentWithProperties(FilterEditor, {
            title: "Verplicht als...",
            selectedFilter: this.cachedRequiredFilter ?? new FilterGroup(this.definitions),
            organization: this.organization,
            setFilter: (requiredWhen: FilterGroup<any>) => {
                this.$emit('update:modelValue', 
                    new PropertyFilter<any>(
                        this.value.enabledWhen,
                        requiredWhen.encoded
                    )
                )
            },
            definitions: this.definitions
        }).setDisplayStyle("popup"))
    }

    get enabledText() {
        return (this.cachedEnabledFilter).toString()
    }

    get requiredText() {
        return (this.cachedRequiredFilter ?? "").toString()
    }

}
</script>
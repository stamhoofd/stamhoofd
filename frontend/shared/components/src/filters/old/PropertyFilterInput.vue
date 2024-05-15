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
                    <template #right>
                        <button v-if="!isAlwaysEnabled()" class="button text" type="button" @click="setEnabledWhen(false)">
                            <span class="icon edit" />
                            <span class="hide-small">Wijzig</span>
                        </button>
                    </template>
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
                    <template #right>
                        <button v-if="!isAlwaysRequired() && !isNeverRequired()" class="button text" type="button" @click="setRequiredWhen(false)">
                            <span class="icon edit" />
                            <span class="hide-small">Wijzig</span>
                        </button>
                    </template>
                </STListItem>
            </STList>
        </STInputBox>
        <p v-if="allowOptional" class="style-description-small">
            * Als een vragenlijst niet verplicht is, zal men de stap kunnen overslaan zolang nog niets werd ingevuld. Meestal is het niet nodig om dit te gebruiken. Als de vragenlijst altijd verplicht is om in te vullen, kan je ook nog steeds optionele vragen in die lijst hebben. Meestal is het gewoon duidelijker om optionele vragen te gebruiken. Maar soms wil je bijvoorbeeld 'alles invullen' of 'niets invullen', dan kan je dit best gebruiken.
        </p>

        <div v-if="isDevelopment">
            <code class="style-code">
                {{ encodedJson }}
            </code>
        </div>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop, Watch } from "@simonbackx/vue-app-navigation/classes";
import { isEmptyFilter,Organization, PropertyFilter, StamhoofdFilter, Version } from '@stamhoofd/structures';

import Radio from "../../inputs/Radio.vue";
import STInputBox from "../../inputs/STInputBox.vue";
import STList from "../../layout/STList.vue";
import STListItem from "../../layout/STListItem.vue";
import { filterToString,UIFilter, UIFilterBuilder } from '../UIFilter';
import UIFilterEditor from '../UIFilterEditor.vue';

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
        modelValue!: PropertyFilter

    @Prop({ default: true })
        allowOptional!: boolean

    @Prop({ required: true })
        builder!: UIFilterBuilder

    cachedRequiredFilter: StamhoofdFilter|null = null;
    cachedEnabledFilter: StamhoofdFilter|null = null;

    isAlwaysEnabled() {
        return this.modelValue.enabledWhen === null || isEmptyFilter(this.modelValue.enabledWhen)
    }

    isAlwaysRequired() {
        return this.modelValue.requiredWhen !== null && isEmptyFilter(this.modelValue.requiredWhen)
    }

    isNeverRequired() {
        return this.modelValue.requiredWhen === null
    }

    mounted() {
        this.cacheIfNeeded()
    }

    get isDevelopment() {
        return STAMHOOFD.environment === 'development'
    }

    get encodedJson() {
        return JSON.stringify(
            this.modelValue.encode({version: Version}),
            null,
            4
        )
    }

    cacheIfNeeded() {
        if (this.modelValue.requiredWhen && !isEmptyFilter(this.modelValue.requiredWhen)) {
            this.cachedRequiredFilter = this.modelValue.requiredWhen
        }
        if (this.modelValue.enabledWhen && !isEmptyFilter(this.modelValue.enabledWhen)) {
            this.cachedEnabledFilter = this.modelValue.enabledWhen
        }
    }

    setAlwaysEnabled() {
        this.$emit('update:modelValue', 
            new PropertyFilter(
                null,
                this.modelValue.requiredWhen
            )
        )
    }

    setEnabledWhen(useCache = false) {
        //this.present(new ComponentWithProperties(FilterEditor, {
        //    title: "Vragen als...",
        //    selectedFilter: this.cachedEnabledFilter,
        //    organization: this.organization,
        //    setFilter: (enabledWhen: FilterGroup<any>) => {
        //        this.$emit('update:modelValue', 
        //            new PropertyFilter<any>(
        //                enabledWhen.encoded,
        //                this.modelValue.requiredWhen
        //            )
        //        )
        //    },
        //    definitions: this.definitions
        //}).setDisplayStyle("popup"))
    }

    setAlwaysRequired() {
        this.$emit('update:modelValue', 
            new PropertyFilter(
                this.modelValue.enabledWhen,
                {}
            )
        )
    }

    setNeverRequired() {
        this.$emit('update:modelValue', 
            new PropertyFilter(
                this.modelValue.enabledWhen,
                null
            )
        )
    }

    setRequiredWhen(useCache = false) {
        console.log('setRequiredwhen', useCache);

        if (useCache && this.cachedRequiredFilter && !isEmptyFilter(this.cachedRequiredFilter)) {
            this.$emit('update:modelValue', 
                new PropertyFilter(
                    this.modelValue.enabledWhen,
                    this.cachedRequiredFilter
                )
            )
            return
        }

        const filter = this.modelValue.requiredWhen ? this.builder.fromFilter(this.modelValue.requiredWhen) : this.builder.create() 
        console.log('filter', filter);

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(UIFilterEditor, {
                        filter,
                        saveHandler: (filter: UIFilter) => {
                            this.cachedRequiredFilter = filter.build();
                            
                            this.$emit('update:modelValue', 
                                new PropertyFilter(
                                    this.modelValue.enabledWhen,
                                    this.cachedRequiredFilter
                                )
                            )
                        }
                    })
                })
            ],
            modalDisplayStyle: 'sheet'
        })

        //this.present(new ComponentWithProperties(FilterEditor, {
        //    title: "Verplicht als...",
        //    selectedFilter: this.cachedRequiredFilter ?? new FilterGroup(this.definitions),
        //    organization: this.organization,
        //    setFilter: (requiredWhen: FilterGroup<any>) => {
        //        this.$emit('update:modelValue', 
        //            new PropertyFilter<any>(
        //                this.modelValue.enabledWhen,
        //                requiredWhen.encoded
        //            )
        //        )
        //    },
        //    definitions: this.definitions
        //}).setDisplayStyle("popup"))
    }

    get enabledText() {
        return this.modelValue.enabledWhen ? filterToString(this.modelValue.enabledWhen, this.builder) : '';
    }

    get requiredText() {
        return this.modelValue.requiredWhen ? filterToString(this.modelValue.requiredWhen, this.builder) : '';
    }

}
</script>

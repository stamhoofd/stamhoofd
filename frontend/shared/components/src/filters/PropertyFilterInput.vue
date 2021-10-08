<template>
    <div class="property-filter-value-input">
        <STInputBox title="Wanneer vragen?" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <Radio slot="left" :model-value="isAlwaysEnabled()" :value="true" @change="setAlwaysEnabled()" />
                    <h3 class="style-title-list">
                        Altijd
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <Radio slot="left" :model-value="isAlwaysEnabled()" :value="false" @change="setEnabledWhen(true)" />
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

        <STInputBox title="Wanneer verplicht invullen?" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <Radio slot="left" :model-value="isAlwaysRequired()" :value="true" @change="setAlwaysRequired()" />
                    <h3 class="style-title-list">
                        Invullen altijd verplicht
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <Radio slot="left" :model-value="isNeverRequired()" :value="true" @change="setNeverRequired()" />
                    <h3 class="style-title-list">
                        Invullen nooit verplicht
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <Radio slot="left" :model-value="!isAlwaysRequired() && !isNeverRequired()" :value="true" @change="setRequiredWhen(true)" />
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
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { FilterEditor, Radio,STInputBox, STList, STListItem } from '@stamhoofd/components';
import { FilterGroup, PropertyFilter } from '@stamhoofd/structures';
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

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

    cachedRequiredFilter: FilterGroup<any> | null = null
    cachedEnabledFilter: FilterGroup<any> | null = null

    mounted() {
        this.onConfigurationChange()
    }

    get definitions() {
        return this.value.definitions
    }

    @Watch('value')
    onConfigurationChange() {
        if (this.value.requiredWhen && this.value.requiredWhen.filters.length > 0) {
            this.cachedRequiredFilter = this.value.requiredWhen
        }
        if (this.value.enabledWhen.filters.length > 0) {
            this.cachedEnabledFilter = this.value.enabledWhen
        }
    }

    isAlwaysEnabled() {
        return this.value.enabledWhen.filters.length == 0
    }

    isAlwaysRequired() {
        return this.value.requiredWhen && this.value.requiredWhen.filters.length == 0
    }

    isNeverRequired() {
        return this.value.requiredWhen === null
    }

    setAlwaysEnabled() {
        this.$emit("input", 
            new PropertyFilter<any>(
                new FilterGroup(this.definitions),
                this.value.requiredWhen
            )
        )
    }

    setEnabledWhen(useCache = false) {
        if (useCache && this.cachedEnabledFilter) {
            this.$emit("input", 
                new PropertyFilter<any>(
                    this.cachedEnabledFilter,
                    this.value.requiredWhen
                )
            )
            return
        }

        this.present(new ComponentWithProperties(FilterEditor, {
            title: "Vragen als...",
            selectedFilter: this.cachedEnabledFilter ?? this.value.enabledWhen,
            setFilter: (enabledWhen) => {
                this.$emit("input", 
                    new PropertyFilter<any>(
                        enabledWhen,
                        this.value.requiredWhen
                    )
                )
            },
            definitions: this.definitions
        }).setDisplayStyle("popup"))
    }

    setAlwaysRequired() {
        this.$emit("input", 
            new PropertyFilter<any>(
                this.value.enabledWhen,
                new FilterGroup(this.definitions)
            )
        )
    }

    setNeverRequired() {
        this.$emit("input", 
            new PropertyFilter<any>(
                this.value.enabledWhen,
                null
            )
        )
    }

    setRequiredWhen(useCache = false) {
        if (useCache && this.cachedRequiredFilter) {
            this.$emit("input", 
                new PropertyFilter<any>(
                    this.value.enabledWhen,
                    this.cachedRequiredFilter
                )
            )
            return
        }
        this.present(new ComponentWithProperties(FilterEditor, {
            title: "Verplicht als...",
            selectedFilter: this.cachedRequiredFilter ?? this.value.requiredWhen ?? new FilterGroup(this.definitions),
            setFilter: (requiredWhen) => {
                this.$emit("input", 
                    new PropertyFilter<any>(
                        this.value.enabledWhen,
                        requiredWhen
                    )
                )
            },
            definitions: this.definitions
        }).setDisplayStyle("popup"))
    }

    get enabledText() {
        return (this.cachedEnabledFilter ?? this.value.enabledWhen).toString()
    }

    get requiredText() {
        return (this.cachedRequiredFilter ?? this.value.requiredWhen ?? "").toString()
    }

}
</script>
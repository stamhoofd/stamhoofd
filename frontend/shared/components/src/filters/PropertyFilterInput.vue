<template>
    <div class="property-filter-value-input">
        <STInputBox title="Wanneer ingeschakeld?" class="max">
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

        <STInputBox v-if="allowOptional" title="Wanneer verplicht invullen?" class="max">
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
import { FilterDefinition, FilterGroup, Organization, PropertyFilter } from '@stamhoofd/structures';
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

    @Prop({ default: true })
    allowOptional: boolean

    @Prop({ required: true })
    organization: Organization

    @Prop({ required: true })
    definitions: FilterDefinition[]

    cachedRequiredFilter: FilterGroup<any> | null = null
    cachedEnabledFilter: FilterGroup<any>

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
        this.$emit("input", 
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
                this.$emit("input", 
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
        this.$emit("input", 
            new PropertyFilter<any>(
                this.value.enabledWhen,
                new FilterGroup(this.definitions).encoded
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
                this.$emit("input", 
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
<template>
    <div class="property-filter-configuration-input">
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
import { Filter, FilterDefinition, FilterGroup, PropertyFilterConfiguration } from '@stamhoofd/structures';
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

import PropertyEnabledContextMenu from './PropertyEnabledContextMenu.vue';
import PropertyRequiredContextMenu from './PropertyRequiredContextMenu.vue';

@Component({
    components: {
        STInputBox,
        STList,
        STListItem,
        Radio
    }
})
export default class PropertyFilterConfigurationInput extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    configuration: PropertyFilterConfiguration

    @Prop({ required: true })
    definitions!: FilterDefinition<any, Filter<any>, any>[]

    cachedRequiredFilter: FilterGroup<any> | null = null
    cachedEnabledFilter: FilterGroup<any> | null = null

    mounted() {
        this.onConfigurationChange()
    }

    @Watch('configuration')
    onConfigurationChange() {
        if (this.configuration.requiredWhen && this.configuration.requiredWhen.filters.length > 0) {
            this.cachedRequiredFilter = this.configuration.requiredWhen
        }
        if (this.configuration.enabledWhen.filters.length > 0) {
            this.cachedEnabledFilter = this.configuration.enabledWhen
        }
    }

    isAlwaysEnabled() {
        return this.configuration.enabledWhen.filters.length == 0
    }

    isAlwaysRequired() {
        return this.configuration.requiredWhen && this.configuration.requiredWhen.filters.length == 0
    }

    isNeverRequired() {
        return this.configuration.requiredWhen === null
    }

    setAlwaysEnabled() {
        this.$emit("patch", PropertyFilterConfiguration.patch({
            enabledWhen: new FilterGroup(this.definitions)
        }))
    }

    setEnabledWhen(useCache = false) {
        if (useCache && this.cachedEnabledFilter) {
            this.$emit("patch", PropertyFilterConfiguration.patch({
                enabledWhen: this.cachedEnabledFilter
            }))
            return
        }

        this.present(new ComponentWithProperties(FilterEditor, {
            title: "Vragen als...",
            selectedFilter: this.cachedEnabledFilter ?? this.configuration.enabledWhen,
            setFilter: (enabledWhen) => {
                this.$emit("patch", PropertyFilterConfiguration.patch({
                    enabledWhen
                }))
            },
            definitions: this.definitions
        }).setDisplayStyle("popup"))
    }

    setAlwaysRequired() {
        this.$emit("patch", PropertyFilterConfiguration.patch({
            requiredWhen: new FilterGroup(this.definitions)
        }))
    }

    setNeverRequired() {
        this.$emit("patch", PropertyFilterConfiguration.patch({
            requiredWhen: null
        }))
    }

    setRequiredWhen(useCache = false) {
        if (useCache && this.cachedRequiredFilter) {
            this.$emit("patch", PropertyFilterConfiguration.patch({
                requiredWhen: this.cachedRequiredFilter
            }))
            return
        }
        this.present(new ComponentWithProperties(FilterEditor, {
            title: "Verplicht als...",
            selectedFilter: this.cachedRequiredFilter ?? this.configuration.requiredWhen ?? new FilterGroup(this.definitions),
            setFilter: (requiredWhen) => {
                this.$emit("patch", PropertyFilterConfiguration.patch({
                    requiredWhen
                }))
            },
            definitions: this.definitions
        }).setDisplayStyle("popup"))
    }

    get enabledText() {
        return (this.cachedEnabledFilter ?? this.configuration.enabledWhen).toString()
    }

    get requiredText() {
        return (this.cachedRequiredFilter ?? this.configuration.requiredWhen ?? "").toString()
    }

    openEnabledWhenContextMenu(event: Event) {
        const el = event.target as HTMLElement;
        const displayedComponent = new ComponentWithProperties(PropertyEnabledContextMenu, {
            x: el.getBoundingClientRect().left,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            preferredWidth: el.offsetWidth,
            definitions: this.definitions,
            selectedFilter: this.configuration.enabledWhen,

            handler: (enabledWhen: FilterGroup<any>) => {
                this.$emit("patch", PropertyFilterConfiguration.patch({
                    enabledWhen
                }))
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    openRequiredContextMenu(event: Event) {
        // todo
        const el = event.target as HTMLElement;
        const displayedComponent = new ComponentWithProperties(PropertyRequiredContextMenu, {
            x: el.getBoundingClientRect().left,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            preferredWidth: el.offsetWidth,
            definitions: this.definitions,
            selectedFilter: this.configuration.requiredWhen,

            handler: (requiredWhen: FilterGroup<any> | null) => {
                this.$emit("patch", PropertyFilterConfiguration.patch({
                    requiredWhen
                }))
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;

.property-filter-configuration-input {
    
}
</style>

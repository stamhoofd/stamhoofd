<template>
    <div class="property-filter-configuration-input">
        <div class="input input-dropdown" @click="openEnabledWhenContextMenu">
            {{ enabledText }}
        </div>

        <div class="input input-dropdown" @click="openRequiredContextMenu">
            {{ requiredText }}
        </div>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Filter, FilterDefinition, FilterGroup, PropertyFilterConfiguration } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import PropertyEnabledContextMenu from './PropertyEnabledContextMenu.vue';
import PropertyRequiredContextMenu from './PropertyRequiredContextMenu.vue';

@Component
export default class PropertyFilterConfigurationInput extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    configuration: PropertyFilterConfiguration

    @Prop({ required: true })
    definitions!: FilterDefinition<any, Filter<any>, any>[]

    get enabledText() {
        if (this.configuration.enabledWhen.filters.length == 0) {
            return "Altijd vragen"
        }
        return "Vragen als: eigen voorwaarden"
    }

    get requiredText() {
        if (!this.configuration.requiredWhen) {
            return "Invullen optioneel"
        }

        if (this.configuration.requiredWhen.filters.length == 0) {
            return "Verplicht invullen"
        }

        return "Verplicht als: eigen voorwaarden"
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
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    padding: 10px 0;

    > div {
        margin: 5px 0;
    }
}
</style>

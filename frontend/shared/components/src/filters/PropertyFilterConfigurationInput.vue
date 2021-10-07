<template>
    <div class="property-filter-configuration-input">
        <STInputBox title="Wanneer vragen?">
            <div class="input input-dropdown" @click="openEnabledWhenContextMenu">
                {{ enabledText }}
            </div>
        </STInputBox>

        <STInputBox title="Wanneer verplicht invullen?">
            <div class="input input-dropdown" @click="openRequiredContextMenu">
                {{ requiredText }}
            </div>
        </STInputBox>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { STInputBox } from '@stamhoofd/components';
import { Filter, FilterDefinition, FilterGroup, PropertyFilterConfiguration } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import PropertyEnabledContextMenu from './PropertyEnabledContextMenu.vue';
import PropertyRequiredContextMenu from './PropertyRequiredContextMenu.vue';

@Component({
    components: {
        STInputBox
    }
})
export default class PropertyFilterConfigurationInput extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    configuration: PropertyFilterConfiguration

    @Prop({ required: true })
    definitions!: FilterDefinition<any, Filter<any>, any>[]

    get enabledText() {
        if (this.configuration.enabledWhen.filters.length == 0) {
            return "Altijd"
        }
        return "Als: "+this.configuration.enabledWhen.toString()
    }

    get requiredText() {
        if (!this.configuration.requiredWhen) {
            return "Nooit (optioneel invullen)"
        }

        if (this.configuration.requiredWhen.filters.length == 0) {
            return "Altijd"
        }

        return "Als: "+this.configuration.requiredWhen.toString()
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
    @media (min-width: 700px) {
        display: flex;
        flex-direction: row;
        
        > * {
            flex-basis: 50%;

            &:first-child {
                padding-right: 5px;
            }

            &:last-child {
                padding-left: 5px;
            }
        }
    }
}
</style>

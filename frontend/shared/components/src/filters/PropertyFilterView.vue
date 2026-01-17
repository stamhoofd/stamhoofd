<template>
    <SaveView :title="title" @save="save">
        <h1>
            {{ title }}
        </h1>
        <p v-if="options?.description">
            {{ options.description }}
        </p>

        <p v-if="options?.warning" class="warning-box">
            {{ options.warning }}
        </p>

        <p v-if="parentConfiguration && editingConfiguration" class="warning-box">
            {{ $t('Opgelet, je voegt een uitbreiding toe op de standaardinstelling. Wat je instelt komt bovenop de standaardinstelling. ') }}
        </p>

        <!-- Todo: hier selector: nieuwe filter maken of bestaande filter bewerken, of opslaan als niewue filter -->
        <PropertyFilterInput v-model="editingConfiguration" :builder="builder" :required="!parentConfiguration" :disabled-text="$t('Standaardinstelling')" :disabled-description="parentConfiguration ? propertyFilterToString(parentConfiguration, builder) : ''" />
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { PropertyFilter, Version } from '@stamhoofd/structures';

import STNavigationBar from '../navigation/STNavigationBar.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import PropertyFilterInput from './PropertyFilterInput.vue';
import { propertyFilterToString, UIFilterBuilder } from './UIFilter';

@Component({
    components: {
        STNavigationBar,
        PropertyFilterInput,
    },
})
export default class PropertyFilterView extends Mixins(NavigationMixin) {
    @Prop({ default: '' })
    title!: string;

    @Prop({ default: () => ({}) })
    options?: { warning?: string; description?: string };

    @Prop({ required: true })
    builder!: UIFilterBuilder;

    @Prop({ required: false, default: null })
    parentConfiguration!: PropertyFilter | null;

    @Prop({ required: true })
    configuration!: PropertyFilter | null;

    @Prop({ required: true })
    setConfiguration!: (configuration: PropertyFilter | null) => void;

    editingConfiguration: PropertyFilter | null = this.configuration;

    propertyFilterToString(filter: PropertyFilter, builder: UIFilterBuilder) {
        return propertyFilterToString(filter, builder);
    }

    cancel() {
        this.dismiss({ force: true });
    }

    save() {
        this.setConfiguration(this.editingConfiguration);
        this.dismiss({ force: true });
    }

    isChanged() {
        if (this.editingConfiguration === null || this.configuration === null) {
            return this.editingConfiguration !== this.configuration;
        }
        return JSON.stringify(this.editingConfiguration.encode({ version: Version })) !== JSON.stringify(this.configuration.encode({ version: Version }));
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true;
        }
        return await CenteredMessage.confirm($t(`c9111e95-2f59-4164-b0af-9fbf434bf6dd`), $t(`de41b0f3-1297-4058-b390-3bfb99e3d4e0`));
    }
}
</script>

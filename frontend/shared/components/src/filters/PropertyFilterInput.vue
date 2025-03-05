<template>
    <div class="property-filter-value-input">
        <STInputBox v-if="!isAlwaysEnabled() || hasFilters" class="max" :title="$t(`1f1fdb34-698d-4422-a05c-3b0ec249b5d1`)">
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isAlwaysEnabled()" :value="true" @update:model-value="setAlwaysEnabled()"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('8e770822-d9a0-42f5-8209-20cc99c85ff4') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isAlwaysEnabled()" :value="false" @update:model-value="setEnabledWhen(true)"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('6885b74e-1851-433b-85f0-aaba8b1756fe') }}
                    </h3>
                    <p class="style-description-small">
                        {{ enabledText }}
                    </p>
                    <template #right>
                        <button v-if="!isAlwaysEnabled()" class="button text" type="button" @click="setEnabledWhen(false)">
                            <span class="icon edit"/>
                            <span class="hide-small">{{ $t('73751199-4353-4727-be55-fbb8d6a68f60') }}</span>
                        </button>
                    </template>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox v-if="allowOptional" class="max" :title="$t(`2acc3ab3-9b79-48ba-8ad0-fed4a8f89769`)">
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isAlwaysRequired()" :value="true" @update:model-value="setAlwaysRequired()"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('cb290a00-2914-4123-84fa-e863142c5801') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isNeverRequired()" :value="true" @update:model-value="setNeverRequired()"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('f5e68e84-817f-4a01-91c6-a30d84e818d4') }}
                    </h3>
                </STListItem>

                <STListItem v-if="hasFilters || (!isAlwaysRequired() && !isNeverRequired())" :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="!isAlwaysRequired() && !isNeverRequired()" :value="true" @update:model-value="setRequiredWhen(true)"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('6885b74e-1851-433b-85f0-aaba8b1756fe') }}
                    </h3>
                    <p class="style-description-small">
                        {{ requiredText }}
                    </p>
                    <template #right>
                        <button v-if="!isAlwaysRequired() && !isNeverRequired()" class="button text" type="button" @click="setRequiredWhen(false)">
                            <span class="icon edit"/>
                            <span class="hide-small">{{ $t('73751199-4353-4727-be55-fbb8d6a68f60') }}</span>
                        </button>
                    </template>
                </STListItem>
            </STList>
        </STInputBox>
        <p v-if="allowOptional" class="style-description-small">
            {{ $t("72bdb171-6842-4074-ac28-22ce96411f50") }}
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
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { isEmptyFilter, PropertyFilter, StamhoofdFilter, Version } from '@stamhoofd/structures';

import Radio from '../inputs/Radio.vue';
import STInputBox from '../inputs/STInputBox.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { filterToString, UIFilter, UIFilterBuilder } from './UIFilter';
import UIFilterEditor from './UIFilterEditor.vue';
import { GroupUIFilterBuilder } from './GroupUIFilter';

@Component({
    components: {
        STInputBox,
        STList,
        STListItem,
        Radio,
    },
})
export default class PropertyFilterInput extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    modelValue!: PropertyFilter;

    @Prop({ default: true })
    allowOptional!: boolean;

    @Prop({ required: true })
    builder!: UIFilterBuilder;

    cachedRequiredFilter: StamhoofdFilter | null = null;
    cachedEnabledFilter: StamhoofdFilter | null = null;

    isAlwaysEnabled() {
        return this.modelValue.enabledWhen === null || isEmptyFilter(this.modelValue.enabledWhen);
    }

    isAlwaysRequired() {
        return this.modelValue.requiredWhen !== null && isEmptyFilter(this.modelValue.requiredWhen);
    }

    isNeverRequired() {
        return this.modelValue.requiredWhen === null;
    }

    get hasFilters() {
        return this.builder instanceof GroupUIFilterBuilder && this.builder.builders.length > 1;
    }

    mounted() {
        this.cacheIfNeeded();
    }

    get isDevelopment() {
        return STAMHOOFD.environment === 'development';
    }

    get encodedJson() {
        return JSON.stringify(
            this.modelValue.encode({ version: Version }),
            null,
            4,
        );
    }

    cacheIfNeeded() {
        if (this.modelValue.requiredWhen && !isEmptyFilter(this.modelValue.requiredWhen)) {
            this.cachedRequiredFilter = this.modelValue.requiredWhen;
        }
        if (this.modelValue.enabledWhen && !isEmptyFilter(this.modelValue.enabledWhen)) {
            this.cachedEnabledFilter = this.modelValue.enabledWhen;
        }
    }

    setAlwaysEnabled() {
        this.$emit('update:modelValue',
            new PropertyFilter(
                null,
                this.modelValue.requiredWhen,
            ),
        );
    }

    setEnabledWhen(useCache = false) {
        if (useCache && this.cachedEnabledFilter && !isEmptyFilter(this.cachedEnabledFilter)) {
            this.$emit('update:modelValue',
                new PropertyFilter(
                    this.cachedEnabledFilter,
                    this.modelValue.requiredWhen,
                ),
            );
            return;
        }

        const filter = this.modelValue.enabledWhen ? this.builder.fromFilter(this.modelValue.enabledWhen) : this.builder.create();

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(UIFilterEditor, {
                        filter,
                        saveHandler: (filter: UIFilter) => {
                            this.cachedEnabledFilter = filter.build();
                            console.log('set enabled when', filter, this.cachedEnabledFilter);
                            this.$emit('update:modelValue',
                                new PropertyFilter(
                                    this.cachedEnabledFilter,
                                    this.modelValue.requiredWhen,
                                ),
                            );
                        },
                    }),
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }

    setAlwaysRequired() {
        this.$emit('update:modelValue',
            new PropertyFilter(
                this.modelValue.enabledWhen,
                {},
            ),
        );
    }

    setNeverRequired() {
        this.$emit('update:modelValue',
            new PropertyFilter(
                this.modelValue.enabledWhen,
                null,
            ),
        );
    }

    setRequiredWhen(useCache = false) {
        if (useCache && this.cachedRequiredFilter && !isEmptyFilter(this.cachedRequiredFilter)) {
            this.$emit('update:modelValue',
                new PropertyFilter(
                    this.modelValue.enabledWhen,
                    this.cachedRequiredFilter,
                ),
            );
            return;
        }

        const filter = this.modelValue.requiredWhen ? this.builder.fromFilter(this.modelValue.requiredWhen) : this.builder.create();

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
                                    this.cachedRequiredFilter,
                                ),
                            );
                        },
                    }),
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }

    get enabledText() {
        return this.modelValue.enabledWhen ? filterToString(this.modelValue.enabledWhen, this.builder) : '';
    }

    get requiredText() {
        return this.modelValue.requiredWhen ? filterToString(this.modelValue.requiredWhen, this.builder) : '';
    }
}
</script>

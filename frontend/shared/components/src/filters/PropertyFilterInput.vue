<template>
    <div class="property-filter-value-input">
        <STInputBox v-if="!isAlwaysEnabled() || hasFilters" class="max" :title="$t(`f193133e-143e-48fa-8d13-afcc01031343`)">
            <STList>
                <STListItem v-if="!required" :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isDisabled() === true ? null : isAlwaysEnabled()" :value="null" @update:model-value="setDisabled()" />
                    </template>
                    <h3 class="style-title-list">
                        {{ disabledText || $t('4929b81e-6f1d-4859-889b-3fb016e97286') }}
                    </h3>
                    <p v-if="disabledDescription" class="style-description-small">
                        {{ disabledDescription }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isDisabled() === true ? null : isAlwaysEnabled()" :value="true" @update:model-value="setAlwaysEnabled()" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('8a4842b5-6304-4b02-a8c5-4b837edcd77d') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isDisabled() === true ? null : isAlwaysEnabled()" :value="false" @update:model-value="setEnabledWhen(true)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('a606fec7-273d-4642-b871-002d3f702a21') }}
                    </h3>
                    <p class="style-description-small">
                        {{ enabledText }}
                    </p>
                    <template #right>
                        <button v-if="!isAlwaysEnabled()" class="button text" type="button" @click="setEnabledWhen(false)">
                            <span class="icon edit" />
                            <span class="hide-small">{{ $t('ab817255-45d5-4eb8-970c-ea927730532b') }}</span>
                        </button>
                    </template>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox v-if="modelValue && allowOptional" class="max" :title="$t(`879e4842-92f2-4e15-8a47-0f8e9d79770f`) + '*'">
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isAlwaysRequired()" :value="true" @update:model-value="setAlwaysRequired()" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('410b8deb-32fc-40a2-896a-927922fbf7e0') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isNeverRequired()" :value="true" @update:model-value="setNeverRequired()" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('24cdc0fe-a863-4f1b-a89c-ed8b59fe5e3d') }}
                    </h3>
                </STListItem>

                <STListItem v-if="hasFilters || (!isAlwaysRequired() && !isNeverRequired())" :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="!isAlwaysRequired() && !isNeverRequired()" :value="true" @update:model-value="setRequiredWhen(true)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('a606fec7-273d-4642-b871-002d3f702a21') }}
                    </h3>
                    <p class="style-description-small">
                        {{ requiredText }}
                    </p>
                    <template #right>
                        <button v-if="!isAlwaysRequired() && !isNeverRequired()" class="button text" type="button" @click="setRequiredWhen(false)">
                            <span class="icon edit" />
                            <span class="hide-small">{{ $t('ab817255-45d5-4eb8-970c-ea927730532b') }}</span>
                        </button>
                    </template>
                </STListItem>
            </STList>
        </STInputBox>
        <p v-if="allowOptional" class="style-description-small">
            * {{ $t("63b03f2b-6f8c-465f-9a4f-328fd67131e3") }}
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
import { GroupUIFilterBuilder } from './GroupUIFilter';
import { filterToString, UIFilter, UIFilterBuilder } from './UIFilter';
import UIFilterEditor from './UIFilterEditor.vue';

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
    modelValue!: PropertyFilter | null;

    @Prop({ default: true })
    required!: boolean;

    @Prop({ default: '' })
    disabledText!: string;

    @Prop({ default: '' })
    disabledDescription!: string;

    @Prop({ default: true })
    allowOptional!: boolean;

    @Prop({ required: true })
    builder!: UIFilterBuilder;

    cachedRequiredFilter: StamhoofdFilter | null = null;
    cachedEnabledFilter: StamhoofdFilter | null = null;

    isAlwaysEnabled() {
        if (this.modelValue === null) {
            return false;
        }
        return this.modelValue.enabledWhen === null || isEmptyFilter(this.modelValue.enabledWhen);
    }

    isAlwaysRequired() {
        if (this.modelValue === null) {
            return false;
        }
        return this.modelValue.requiredWhen !== null && isEmptyFilter(this.modelValue.requiredWhen);
    }

    isNeverRequired() {
        if (this.modelValue === null) {
            return true;
        }
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
        if (this.modelValue === null) {
            return 'null';
        }

        return JSON.stringify(
            this.modelValue.encode({ version: Version }),
            null,
            4,
        );
    }

    cacheIfNeeded() {
        if (!this.modelValue) {
            return;
        }
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
                this.modelValue?.requiredWhen ?? {},
            ),
        );
    }

    isDisabled() {
        return this.modelValue === null;
    }

    setDisabled() {
        this.$emit('update:modelValue',
            null,
        );
    }

    setEnabledWhen(useCache = false) {
        if (useCache && this.cachedEnabledFilter && !isEmptyFilter(this.cachedEnabledFilter)) {
            this.$emit('update:modelValue',
                new PropertyFilter(
                    this.cachedEnabledFilter,
                    this.modelValue?.requiredWhen ?? {},
                ),
            );
            return;
        }

        const filter = this.modelValue?.enabledWhen ? this.builder.fromFilter(this.modelValue.enabledWhen) : this.builder.create();

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
                                    this.modelValue?.requiredWhen ?? {},
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
                this.modelValue?.enabledWhen ?? null,
                {},
            ),
        );
    }

    setNeverRequired() {
        this.$emit('update:modelValue',
            new PropertyFilter(
                this.modelValue?.enabledWhen ?? null,
                null,
            ),
        );
    }

    setRequiredWhen(useCache = false) {
        if (useCache && this.cachedRequiredFilter && !isEmptyFilter(this.cachedRequiredFilter)) {
            this.$emit('update:modelValue',
                new PropertyFilter(
                    this.modelValue?.enabledWhen ?? null,
                    this.cachedRequiredFilter,
                ),
            );
            return;
        }

        const filter = !this.modelValue ? (this.builder.create()) : (isEmptyFilter(this.modelValue.requiredWhen) ? this.builder.create() : this.builder.fromFilter(this.modelValue.requiredWhen));

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(UIFilterEditor, {
                        filter,
                        saveHandler: (filter: UIFilter) => {
                            this.cachedRequiredFilter = filter.build();

                            this.$emit('update:modelValue',
                                new PropertyFilter(
                                    this.modelValue?.enabledWhen ?? null,
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
        if (!this.modelValue) {
            return '';
        }
        return this.modelValue.enabledWhen ? filterToString(this.modelValue.enabledWhen, this.builder) : '';
    }

    get requiredText() {
        if (!this.modelValue) {
            return '';
        }

        if (isEmptyFilter(this.modelValue.requiredWhen)) {
            return '';
        }
        return filterToString(this.modelValue.requiredWhen, this.builder);
    }
}
</script>

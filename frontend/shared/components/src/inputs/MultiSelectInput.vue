<template>
    <STInputBox v-bind="$attrs">
        <template #right>
            <button v-if="model.length" class="button text icon add" type="button" @click="openContextMenu" />
        </template>
        <div v-if="model.length === 0" class="multi-select-container input-icon-container right icon arrow-down-small gray">
            <div class="input selectable placeholder" @click="openContextMenu">
                {{ placeholder }}
            </div>
        </div>
        <div v-else class="multi-select-container">
            <div class="input">
                <STList v-model="draggableValues" :draggable="true" :item-key="(v: T) => (v as any)">
                    <template #item="{item: value}">
                        <STListItem :selectable="true" @click="openContextMenu($event, value)">
                            <span v-for="(label, index) of getValueLabels(value)" :key="index" :title="label" v-text="label" />

                            <template #right>
                                <span class="button icon arrow-down-small gray" />
                                <span v-if="draggableValues.length > 1" class="button icon drag gray" @click.stop @contextmenu.stop />
                                <button class="button icon trash gray" type="button" @click="deleteValue(value)" />
                            </template>
                        </STListItem>
                    </template>
                </STList>
            </div>
        </div>
    </STInputBox>
</template>

<script lang="ts" setup generic="T">
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';

import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import STInputBox from './STInputBox.vue';

const model = defineModel<T[]>({ required: true });

const props = withDefaults(defineProps<{
    choices: { value: T; label: string; categories?: string[] }[];
    placeholder?: string;
}>(), {
    placeholder: () => $t(`%1Fq`),
});

const draggableValues = computed({
    get: () => model.value,
    set: (arr: T[]) => {
        if (arr.length !== model.value.length) {
            return;
        }
        model.value = arr;
    },
});

function getValueLabels(value: T) {
    const choice = props.choices.find(c => c.value === value);
    if (!choice) {
        return ['?'];
    }
    return [
        ...(choice.categories ?? []),
        choice.label,
    ];
}

function openContextMenu(event: TouchEvent | MouseEvent, replace?: T) {
    const menu = generateMenu(props.choices, replace);
    menu.show({
        clickEvent: event,
    }).catch(console.error);
}

function addValue(value: T, replace?: T) {
    if (replace) {
        const index = model.value.findIndex(v => v === replace);
        if (index !== -1) {
            const arr = [...model.value];
            arr[index] = value;
            model.value = arr;
            return;
        }
    }
    model.value = [...model.value, value];
}

function deleteValue(value: T) {
    model.value = model.value.filter(v => v !== value);
}

function generateMenu(choices: { value: T; label: string; categories?: string[] }[], replace?: T): ContextMenu {
    const rootCategories = Formatter.uniqueArray(choices.map(c => c.categories?.[0]).filter(c => !!c)).sort(Sorter.byStringValue);

    return new ContextMenu([
        choices.filter(c => !c.categories?.[0]).map((choice) => {
            return new ContextMenuItem({
                name: choice.label,
                action: () => {
                    // Add a new value
                    addValue(choice.value, replace);
                    return true;
                },
            });
        }),
        rootCategories.map((category) => {
            const subChoices = choices.filter(c => c.categories?.[0] === category).map((c) => {
                return {
                    ...c,
                    categories: c.categories?.slice(1),
                };
            });
            return new ContextMenuItem({
                name: category,
                childMenu: generateMenu(subChoices, replace),
            });
        }),
    ]);
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.multi-select-container {
    .input.placeholder {
        color: $color-gray-5;
    }
    --st-horizontal-padding: 15px;
    --st-list-padding: 10px;

    .input:not(.placeholder) {
        padding: 0 15px;
        height: auto;
    }

    .st-list-item .middle {
        display: flex;

        > span {
            display: block;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            flex-shrink: 20;

            &::before {
                content: ' → ';
                white-space: pre-wrap;
                display: inline-block;
            }

            &:first-child {
                flex-shrink: 30;

                &::before {
                    content: none;
                }
            }

            &:last-child {
                flex-shrink: 0;
            }
        }
    }
}
</style>

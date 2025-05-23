<template>
    <STList v-if="filters.length" v-model="draggableFilters" class="group-ui-filter-list" :draggable="true">
        <template #item="{item: child, index}">
            <STListItem :selectable="!isGroup(child)" class="right-stack group-ui-filter-row" :class="{isLast: index === filters.length - 1, isFirst: index === 0}" @click="isGroup(child) ? undefined : editFilter(index, child)">
                <template v-if="isGroup(child)" #left>
                    <span class="group-ui-filter-child-line" />
                </template>

                <div v-if="!isGroup(child)">
                    <template v-for="(s, i) in child.styledDescription" :key="i">
                        <span v-if="s.choices?.length" class="button text inline margin-space" :class="s.style" type="button" @click.stop.prevent="$event => showChoices($event, s.choices!)">
                            <span v-text="getSelectedChoiceText(s.choices)" />
                            <span class="icon arrow-down-small" />
                        </span>
                        <span v-else class="styled-description" :class="s.style" v-text="s.text" />
                    </template>
                </div>
                <div v-else>
                    <GroupUIFilterList :filter="child" @click.stop @replace="setFilter(index, child, $event)" />
                </div>

                <div v-if="index < filters.length - 1" class="group-ui-filter-mode" @click.stop>
                    <Dropdown :model-value="filter.mode" @update:model-value="setFilterMode($event, index)">
                        <option :value="GroupUIFilterMode.And">
                            {{ $t('ebf4d767-4f8f-4f6c-9130-e3b4e8819add') }}
                        </option>
                        <option :value="GroupUIFilterMode.Or">
                            {{ $t('5df94168-bd59-43b9-986d-57a9c6f7a9b5') }}
                        </option>
                    </Dropdown>
                </div>

                <template v-if="!isGroup(child)" #right>
                    <button class="button icon trash gray" type="button" @click="deleteFilter(index, child)" />
                    <span class="icon edit gray" />
                    <span v-if="filters.length > 1" class="button icon drag gray" @click.stop @contextmenu.stop />
                </template>
            </STListItem>
        </template>
    </STList>
    <p v-else>
        {{ $t('f773f4fc-c4e9-4792-a0a4-c9e969f0b245') }}
    </p>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';

import { computed } from 'vue';
import Dropdown from '../../inputs/Dropdown.vue';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import { GroupUIFilter, GroupUIFilterMode } from '../GroupUIFilter';
import { StyledDescriptionChoice, UIFilter } from '../UIFilter';
import UIFilterEditor from '../UIFilterEditor.vue';

const props = defineProps<{
    filter: GroupUIFilter;
}>();
const show = useShow();

const emit = defineEmits<{
    replace: [patch: UIFilter | null];
}>();
const filters = computed(() => props.filter.filters);

const draggableFilters = computed({
    get: () => filters.value,
    set: (value: UIFilter[]) => {
        const clone = props.filter.clone();
        clone.filters = value;
        emit('replace', clone.flatten());
    },
});

function getSelectedChoiceText(choices: StyledDescriptionChoice[]) {
    return choices.find(c => c.isSelected())?.text;
}

async function showChoices(event: MouseEvent, choices: StyledDescriptionChoice[]) {
    const menu = new ContextMenu([
        choices.map((choice) => {
            return new ContextMenuItem({
                name: choice.text,
                action: choice.action,
            });
        }),
    ]);

    await menu.show({
        button: event.currentTarget as HTMLElement,
    });
}

async function editFilter(index: number, filter: UIFilter) {
    await show({
        components: [
            new ComponentWithProperties(UIFilterEditor, {
                filter,
                saveHandler: (f: UIFilter) => {
                    const ff = f.flatten();
                    if (!ff) {
                        filters.value.splice(index, 1);
                        return;
                    }
                    filters.value.splice(index, 1, ff);
                },
                deleteHandler: () => {
                    deleteFilter(index, filter);
                },
            }),
        ],
    });
}

function deleteFilter(index: number, filter: UIFilter) {
    const clone = props.filter.clone();
    clone.filters.splice(index, 1);
    emit('replace', clone.flatten());
}

function setFilter(index: number, oldFilter: UIFilter, newFilter: UIFilter | null) {
    if (!newFilter) {
        deleteFilter(index, oldFilter);
        return;
    }

    const clone = props.filter.clone();
    clone.filters.splice(index, 1, newFilter);
    emit('replace', clone.flatten());
}

function isGroup(filter: UIFilter): filter is GroupUIFilter {
    return (filter instanceof GroupUIFilter) && !filter.builder.wrapFilter && !filter.builder.wrapper;
}

function setFilterMode(mode: GroupUIFilterMode, index: number) {
    if (mode === props.filter.mode) {
        return;
    }

    if (filters.value.length <= 2) {
        const cloned = props.filter.clone();
        cloned.mode = mode;
        emit('replace', cloned.flatten());
        return;
    }

    const item1 = filters.value[index];
    const item2 = filters.value[index + 1];

    if (!item1 || !item2) {
        return;
    }

    const newChildGroup = props.filter.clone();
    newChildGroup.filters = [item1, item2];
    newChildGroup.mode = mode;

    filters.value.splice(index, 2, newChildGroup);
    const flatten = props.filter.flatten();
    if (flatten !== props.filter) {
        emit('replace', flatten);
    }
}

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-ui-filter-mode {
    position: absolute;
    bottom: 0;
    left: var(--st-horizontal-padding, 40px);
    transform: translateY(50%);
    z-index: 10;
    transition: opacity 0.2s;

    .sortable-drag & {

        opacity: 0;
    }

    .st-list.is-dragging & {
        opacity: 0;
    }
}

.group-ui-filter-list {
    --st-list-padding: 30px;
    --st-list-padding-top: 30px;
    --st-list-padding-bottom: 30px;
}

.group-ui-filter-row {
    position: relative;
    contain: none;
    --st-list-padding: 30px;
    --st-list-padding-top: 30px;
    --st-list-padding-bottom: 30px;

    &.isFirst {
       --st-list-padding-top: 15px;
    }

    // We use js selectors because during drag, :first-child and :last-child are not correct
    &.isLast {
        --st-list-padding-bottom: 15px;
    }
}

.group-ui-filter-list + hr {
    margin-top: 10px !important;
}

.group-ui-filter-child-line {
    height: calc(100% - 60px);
    width: $border-width-thin;
    background: $color-border;
    top: 30px;
    position: absolute;
}

.margin-space {
    margin-left: 0.5ch;
    margin-right: 0.5ch;
}
</style>

<template>
    <STInputBox v-bind="$attrs">
        <template #right>
            <button v-if="modelValue.length" class="button text icon add" type="button" @click="openContextMenu" />
        </template>
        <div v-if="modelValue.length == 0" class="multi-select-container input-icon-container right icon arrow-down-small gray">
            <div class="input selectable placeholder" @click="openContextMenu">
                {{ placeholder }}
            </div>
        </div>
        <div v-else class="multi-select-container">
            <div class="input">
                <STList v-model="draggableValues" :draggable="true">
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

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";
import { Sorter } from '@stamhoofd/utility';
import { Formatter } from "@stamhoofd/utility"

import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STList,
        STListItem,
        STInputBox
    },
    emits: ['update:modelValue']
})
export default class MultiSelectInput<T> extends Mixins(NavigationMixin) {
    @Prop({})
        modelValue: T[]

    @Prop({})
        choices: {value: T, label: string, categories?: string[]}[]

    @Prop({ default: "Maak een keuze" })
        placeholder!: string

    get draggableValues() {
        return this.modelValue
    }

    set draggableValues(arr: T[]) {
        if (arr.length != this.modelValue.length) {
            return;
        }
        this.$emit('update:modelValue', arr)
    }

    getValueLabels(value: T) {
        const choice = this.choices.find(c => c.value === value);
        if (!choice) {
            return ["?"]
        }
        return [
            ...(choice.categories ?? []),
            choice.label
        ]
    }

    openContextMenu(event: TouchEvent | MouseEvent, replace?: T) {        
        const menu = this.generateMenu(this.choices, replace)
        menu.show({
            clickEvent: event
        }).catch(console.error)
    }

    addValue(value: T, replace?: T) {
        if (replace) {
            const index = this.modelValue.findIndex(v => v === replace)
            if (index !== -1) {
                const arr = [...this.modelValue]
                arr[index] = value;
                this.$emit('update:modelValue', arr)
                return;
            }
        }
        const arr = [...this.modelValue, value]
        this.$emit('update:modelValue', arr)
    }

    deleteValue(value: T) {
        const arr = this.modelValue.filter(v => v !== value)
        this.$emit('update:modelValue', arr)
    }

    generateMenu(choices: {value: T, label: string, categories?: string[]}[], replace?: T): ContextMenu {
        const rootCategories = Formatter.uniqueArray(choices.map(c => c.categories?.[0]).filter(c => !!c)).sort(Sorter.byStringValue)

        return new ContextMenu([
            choices.filter(c => !c.categories?.[0]).map(choice => {
                return new ContextMenuItem({
                    name: choice.label,
                    action: () => {
                        // Add a new value
                        this.addValue(choice.value, replace)
                        return true;
                    }
                })
            }),
            rootCategories.map(category => {
                const subChoices = choices.filter(c => c.categories?.[0] === category).map(c => {
                    return {
                        ...c,
                        categories: c.categories?.slice(1)
                    }
                })
                return new ContextMenuItem({
                    name: category,
                    childMenu: this.generateMenu(subChoices, replace)
                })
            })
        ])
    }
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

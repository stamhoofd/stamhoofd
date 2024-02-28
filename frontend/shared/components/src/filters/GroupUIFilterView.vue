<template>
    <div class="container">
        <h1 v-if="canPop">
            Filtergroep
        </h1>
        <p v-if="canPop">
            Met een filtergroep kan je combinaties van 'en' en 'of' maken.
        </p>

        <STList v-if="filters.length">
            <STListItem v-for="(filter, index) in filters" :key="filter.id" :selectable="true" class="right-stack" @click="editFilter(index, filter)">
                <span v-for="(s, i) in filter.styledDescription" :key="i" :class="'styled-description ' + s.style" v-text="s.text" />

                <template slot="right">
                    <button class="button icon trash gray" type="button" @click="deleteFilter(index, filter)" />
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <hr v-if="filters.length">
        <h2 v-if="filters.length">
            Nog een filter toevoegen
        </h2>

        <STList>
            <STListItem v-for="(builder, index) in builders" :key="index" :selectable="true" class="right-stack" @click="addFilter(builder)">
                {{ builder.name }}

                <template slot="left">
                    <span class="button icon add gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Dropdown, STInputBox, STList, STListItem, STNavigationBar } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { GroupUIFilter } from "./GroupUIFilter";
import { UIFilter, UIFilterBuilder } from "./UIFilter";
import UIFilterEditor from "./UIFilterEditor.vue";

@Component({
    components: {
        STInputBox,
        STListItem,
        STList,
        Dropdown,
        STNavigationBar
    }
})
export default class GroupUIFilterView extends Mixins(NavigationMixin)  {
    @Prop({required: true})
        filter: GroupUIFilter

    get filters() {
        return this.filter.filters
    }

    get builders() {
        return this.filter.builders
    }

    editFilter(index: number, filter: UIFilter) {
        this.show({
            components: [
                new ComponentWithProperties(UIFilterEditor, {
                    filter,
                    saveHandler: (f: UIFilter) => {
                        this.filters.splice(index, 1, f)
                    },
                    deleteHandler: () => {
                        this.deleteFilter(index, filter);
                    }
                })
            ]
        })
    }

    deleteFilter(index: number, filter: UIFilter) {
        this.filters.splice(index, 1);
    }

    addFilter(builder: UIFilterBuilder) {
        const filter = builder.create();
        this.show({
            components: [
                new ComponentWithProperties(UIFilterEditor, {
                    filter,
                    saveHandler: (f: UIFilter) => {
                        this.filters.push(f);
                    }
                })
            ]
        })
    }
   
}
</script>
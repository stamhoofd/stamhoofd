<template>
    <div class="group-tree">
        <component :is="'h'+level" v-if="level > 0">{{ category.settings.name }}</component>
        <p v-if="level === 1">Hier komt een beschrijving</p>

        <div class="group-grid" v-if="category.groups.length > 0">
            <GroupBox v-for="group in category.groups" :key="group.id" :group="group" />
        </div>
        <GroupTree v-else v-for="category in category.categories" :key="category.id" :category="category" :parentLevel="level" />

        <hr v-if="level == 1" />
    </div>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Category, GroupCategoryTree, Product, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import GroupBox from "./GroupBox.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        GroupBox
    }
})
export default class GroupTree extends Mixins(NavigationMixin){
    @Prop({ required: true })
    category: GroupCategoryTree

    @Prop({ default: -1 })
    parentLevel!: number

    get level() {
        return Math.min(this.parentLevel + 1, 2)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-tree {
    padding-bottom: 20px;

    > h1 {
        padding-bottom: 15px;
        @extend .style-title-1;
    }

    > h2 {
        padding-bottom: 15px;
        @extend .style-title-2;
    }

    > p {
        @extend .style-description;
        padding-bottom: 40px;
    }

    > hr {
        @extend .style-hr;
    }

}
.group-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding-bottom: 20px;

    @media (max-width: 800px) {
        gap: 0;
        grid-template-columns: 1fr;
    }
}

</style>
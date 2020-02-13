<template>
    <div style="padding: 40px 40px">
        todo: we'll add the menu here

        <p><button class="button" @click="link1">Link 1</button></p>

        <p><button class="button" @click="link2">Link 2</button></p>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import EditGroupDetail from "./EditGroupDetail.vue";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import GroupList from "./GroupList.vue";

@Component({})
export default class Menu extends Mixins(NavigationMixin) {
    mounted() {
        this.showDetail(new ComponentWithProperties(GroupList, {}));
    }

    link1() {
        this.showDetail(new ComponentWithProperties(GroupList, {}));
    }

    link2() {
        this.show(new ComponentWithProperties(GroupList, {}));
    }
}
</script>

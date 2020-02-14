<template>
    <div style="padding: 40px 40px">
        <p><button class="button" v-if="canPop" @click="pop">Terug</button></p>
        This is the group list Tekst: <input class="input" type="text" />
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import EditGroupDetail from "./EditGroupDetail.vue";
import { NavigationMixin } from "shared/classes/NavigationMixin";

@Component({})
export default class GroupList extends Mixins(NavigationMixin) {}
</script>

<style scoped lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';
</style>

<template>
    <div style="padding: 40px 40px">
        <div class="navigation-bar">
            <h1>Kapoenen</h1>

            <div>
                <input class="input search" placeholder="Zoeken" />

                <select class="input">
                    <option>Alle leden</option>
                    <option>Niet betaald</option>
                </select>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import { NavigationMixin } from "shared/classes/NavigationMixin";

@Component({})
export default class GroupList extends Mixins(NavigationMixin) {
    next() {
        this.show(new ComponentWithProperties(GroupList, {}));
    }
}
</script>

<style scoped lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';

h1 {
    @extend .style-title-1;
}

.navigation-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;

    & > div {
        .input {
            width: 220px;
            display: inline-block;
            margin: 0 10px;
        }

        select.input {
            width: auto;
        }
    }
}

.sticky {
    background: white;
    top: 0;
    padding: 20px;
    position: sticky;
}
</style>

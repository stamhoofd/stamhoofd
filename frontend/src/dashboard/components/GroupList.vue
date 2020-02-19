<template>
    <div class="group-list">
        <div class="navigation-bar">
            <h1>
                Kapoenen
                <button class="button more"></button>
            </h1>

            <div>
                <input class="input search" placeholder="Zoeken" />

                <select class="input">
                    <option>Alle leden</option>
                    <option>Niet betaald</option>
                </select>
            </div>
        </div>

        <table class="data-table">
            <thead>
                <tr>
                    <th><Checkbox /></th>
                    <th>Naam</th>
                    <th>Info</th>
                    <th>Status</th>
                    <th>Acties</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(n, index) in 50" :key="index">
                    <td><Checkbox /></td>
                    <td>Rodolphus Lestrange</td>
                    <td>16 jaar</td>
                    <td>Nog niet betaald</td>
                    <td>Bewerken</td>
                    <td>-></td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import Checkbox from "shared/components/inputs/Checkbox.vue";

@Component({
    components: {
        Checkbox
    }
})
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

.group-list {
    padding: 40px 0;
}

h1 {
    @extend .style-title-1;
}

.data-table {
    width: 100%;
    border-collapse: separate;

    thead {
        background: white;
        text-align: left;
        font-weight: 600;
        position: sticky;
        top: 0;

        th {
            border-bottom: $border-width solid $color-gray-lighter;
            vertical-align: middle;
            @extend .style-table-head;
            padding: 10px;

            &:first-child {
                padding-left: 0;
            }
        }
    }

    tbody {
        td {
            padding: 5px 10px;

            &:first-child {
                padding-left: 0;
            }
        }

        tr {
            td {
                border-bottom: $border-width solid $color-gray-lighter;

                &:first-child {
                    border-bottom: 0;
                }
            }

            &:last-child {
                td {
                    border-bottom: 0;
                }
            }

            &:hover {
                background-color: $color-primary-lighter;
            }
        }
    }

    thead,
    tbody {
        th,
        td {
            &:first-child {
                padding-left: 40px;
                white-space: nowrap;
                width: 1px;
            }
            &:last-child {
                padding-right: 40px;
            }
        }
    }
}

.navigation-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 40px;
    margin-bottom: 20px;

    & > div {
        text-align: right;

        h1 {
            flex-shrink: 0;
        }

        .input {
            width: 220px;
            display: inline-block;
            margin: 5px 5px;
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

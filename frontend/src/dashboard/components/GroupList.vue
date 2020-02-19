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
                    <th><Checkbox :value="this.selectionCount == this.members.length" @input="selectAll($event)" /></th>
                    <th>Naam</th>
                    <th>Info</th>
                    <th>Status</th>
                    <th>Acties</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(member, index) in members" :key="index" @click="showMember(member)">
                    <td @click.stop="">
                        <Checkbox v-model="member.selected" @input="onChanged(member)" />
                    </td>
                    <td>{{ member.member.name }}</td>
                    <td class="minor">16 jaar</td>
                    <td>Nog niet betaald</td>
                    <td>Bewerken</td>
                    <td>-></td>
                </tr>
            </tbody>
        </table>

        <div class="toolbar">
            <div>{{ selectionCount ? selectionCount : "Geen" }} leden geselecteerd</div>
            <div>
                <button class="button secundary">Exporteren</button
                ><button class="button primary">Mail iedereen</button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import Checkbox from "shared/components/inputs/Checkbox.vue";
import { Member } from "shared/models/Member";
import GroupListShort from "./GroupListShort.vue";
import NavigationController from "shared/components/layout/NavigationController.vue";

class SelectableMember {
    member: Member;
    selected: boolean = false;

    constructor(member: Member) {
        this.member = member;
    }
}

@Component({
    components: {
        Checkbox
    }
})
export default class GroupList extends Mixins(NavigationMixin) {
    members: SelectableMember[] = [];
    selectionCount: number = 0;

    mounted() {
        for (let index = 0; index < 50; index++) {
            this.members.push(new SelectableMember(new Member("Rodolphus Lestrange")));
        }
    }
    next() {
        this.show(new ComponentWithProperties(GroupList, {}));
    }

    onChanged(selectableMember: SelectableMember) {
        if (!selectableMember.selected) {
            this.selectionCount--;
        } else {
            this.selectionCount++;
        }
    }

    showMember(selectableMember: SelectableMember) {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(GroupListShort, {})
        });
        component.modalDisplayStyle = "popup";
        this.present(component);
    }

    selectAll(selected: boolean) {
        this.selectionCount = selected ? this.members.length : 0;
        this.members.forEach(member => {
            member.selected = selected;
        });
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
    background: $color-white;
}

h1 {
    @extend .style-title-1;
}

.data-table {
    width: 100%;
    border-collapse: separate;

    thead {
        background: $color-white;
        text-align: left;
        font-weight: 600;
        position: sticky;
        top: 0;

        th {
            border-bottom: $border-width solid $color-gray-lighter;
            @extend .style-table-head;
            padding: 10px;

            &:first-child {
                padding-left: 0;
            }
        }
    }

    tbody {
        td {
            padding: 15px 10px;

            &:first-child {
                padding-left: 0;
            }
        }

        tr {
            transition: background-color 0.2s;
            cursor: pointer;
            touch-action: manipulation;

            td {
                border-bottom: $border-width solid $color-gray-lighter;

                &:first-child {
                    border-bottom: 0;
                }

                &.minor {
                    color: $color-gray;
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

            &:active {
                background-color: $color-primary-light;
            }
        }
    }

    thead,
    tbody {
        th,
        td {
            vertical-align: middle;

            &:first-child {
                padding: 0;
                padding-left: 40px - 10px - 5px;
                white-space: nowrap;
                width: 1px;

                .checkbox {
                    margin: 0;
                    padding: 10px;
                }
            }
            &:last-child {
                padding-right: 40px;
            }
        }
    }
}

.toolbar {
    padding: 10px 40px;
    background: $color-white;
    position: sticky;
    bottom: 0;
    border-top: $border-width solid $color-gray-lighter;
    display: flex;
    align-items: center;
    justify-content: space-between;

    > div:first-child {
        @extend .style-description;
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

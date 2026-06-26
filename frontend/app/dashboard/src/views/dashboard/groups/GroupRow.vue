<template>
    <STListItem v-long-press="(e: any) => canShowMenu && showContextMenu(e)" :selectable="true" class="right-stack" @click="canShowMenu && editGroup()" @contextmenu.prevent="canShowMenu && showContextMenu($event)">
        <template #left>
            <GroupAvatar :group="group" />
        </template>

        <h2 class="style-title-list">
            {{ group.settings.name }}
        </h2>
        <template #right>
            <button v-if="canShowMenu" type="button" class="button icon more gray hide-smartphone" @click.stop.prevent="showContextMenu" @contextmenu.stop />
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import type { Group, Organization, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { useGroupActions } from '../../members/useGroupActions';

const props = defineProps<{
    group: Group;
    organization: Organization;
    period: OrganizationRegistrationPeriod;
    periods: OrganizationRegistrationPeriod[];
}>();

const emit = defineEmits<{
    (e: 'patch:periods', value: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>): void;
}>();

const { showMenu: showContextMenu, editGroup, canShowMenu } = useGroupActions(
    patch => emit('patch:periods', patch),
)(props);
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-row-image {
    width: 50px;
    height: 50px;
    margin: -5px 0;
    border-radius: $border-radius;
}
</style>

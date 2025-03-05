<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ group.name }}
        </h2>

        <p v-if="group.description" class="style-description">
            {{ group.description }}
        </p>

        <p v-if="group.minAge && group.maxAge" class="style-description">
            {{ group.minAge }} - {{ group.maxAge }} {{ $t('713d01b3-ff96-4f72-a393-562b95044880') }}
        </p>

        <p v-if="!group.defaultMembershipTypeId" class="style-description">
            {{ $t('b05c255c-8530-4aa4-b2d2-b3aed7256e17') }}
        </p>

        <p v-if="group.minimumRequiredMembers" class="style-description">
            {{ $t('6805286d-d7bb-4a26-8b36-26ec76b8ad3c') }} {{ Formatter.pluralText(group.minimumRequiredMembers, 'lid', 'leden') }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop/>
            <span class="icon arrow-right-small gray"/>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { DefaultAgeGroup } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

defineProps<{
    group: DefaultAgeGroup;
}>();

function showContextMenu() {
    // todo
}

</script>

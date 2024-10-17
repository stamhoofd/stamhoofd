<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ tag.name }}
        </h2>
        <p v-if="childTagCount > 0" class="style-description-small">
            {{ capitalizeFirstLetter(pluralText(childTagCount, getOrganizationTagTypeName(childType), getOrganizationTagTypePluralName(childType))) }}
        </p>
        <p v-if="tag.description" class="style-description-small pre-wrap style-limit-lines" v-text="tag.description" />

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { getOrganizationTagTypeName, getOrganizationTagTypePluralName, OrganizationTag } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    tag: OrganizationTag;
    allTags: OrganizationTag[];
}>();

const childTagCount = computed(() => props.tag.childTags.length);
const childType = computed(() => props.tag.getChildType(props.allTags));

</script>

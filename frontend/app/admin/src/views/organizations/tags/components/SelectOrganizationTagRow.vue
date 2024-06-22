<template>
    <STListItem :selectable="true" element-name="label">
        <template #left>
            <Checkbox v-model="enabled" />
        </template>

        <h2 class="style-title-list">
            {{ tag.name }}
        </h2>
    </STListItem>
</template>

<script lang="ts" setup>
import { useEmitPatch } from '@stamhoofd/components';
import { OrganizationTag, Organization, OrganizationMetaData } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    tag: OrganizationTag;
    organization: Organization;
}>();
const emit = defineEmits(['patch:organization'])

const {patched, addPatch} = useEmitPatch<Organization>(props, emit, 'organization')

const enabled = computed({
    get: () => patched.value.meta.tags.includes(props.tag.id),
    set: (value: boolean) => {
        if (value === patched.value.meta.tags.includes(props.tag.id)) {
            return;
        }

        const removed = patched.value.meta.tags.filter(id => id !== props.tag.id)
        if (value) {
            removed.push(props.tag.id)
        }

        addPatch({
            meta: OrganizationMetaData.patch({
                tags: removed as any
            })
        })
    }
});

</script>

<!-- eslint-disable vue/multiline-html-element-content-newline -->
<template>
    <p v-for="(item, index) of items" :key="index" class="style-description-small style-capitalize-first-letter">
        <RenderTextComponent :text="getRenderText(item)" />
    </p>
</template>

<script setup lang="ts">
import { AuditLogPatchItem, AuditLogPatchItemType } from '@stamhoofd/structures';
import { RenderTextComponent } from './RenderTextComponent';

defineProps<{
    items: AuditLogPatchItem[];
}>();

function getRenderText(item: AuditLogPatchItem): any[] {
    const text: any[] = [
        item.key,
    ];

    if (item.value && !item.oldValue && item.type === AuditLogPatchItemType.Added) {
        text.push(' toegevoegd');
    }

    if (!item.value && item.oldValue && item.type === AuditLogPatchItemType.Removed) {
        text.push(' verwijderd');
    }

    if (item.type === AuditLogPatchItemType.Changed) {
        text.push(' aangepast');
    }

    if (item.type === AuditLogPatchItemType.Reordered) {
        text.push(' volgorde gewijzigd');
    }

    if (item.oldValue || item.value) {
        text.push(': ');

        const hasOld = item.oldValue && (item.oldValue.type || item.oldValue.value);
        const hasValue = item.value && (item.value.type || item.value.value);

        if (hasOld) {
            text.push(item.oldValue);
        }

        if (hasOld && hasValue) {
            text.push(' → ');
        }

        if (hasValue) {
            text.push(item.value);
        }
    }

    return text;
}

</script>

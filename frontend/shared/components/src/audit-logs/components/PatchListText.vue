<!-- eslint-disable vue/multiline-html-element-content-newline -->
<template>
    <p v-for="(item, index) of items" :key="index" class="style-description-small style-capitalize-first-letter">
        <RenderTextComponent :text="getRenderText(item)" />
    </p>
</template>

<script setup lang="ts">
import { AuditLogPatchItem, AuditLogPatchItemType, isUuid } from '@stamhoofd/structures';
import { Context, Renderable, renderAny, RenderTextComponent } from './RenderTextComponent';
import { h } from 'vue';

defineProps<{
    items: AuditLogPatchItem[];
}>();

class TextWithClass implements Renderable {
    children: unknown;
    className: string;

    constructor(children: unknown, className: string) {
        this.children = children;
        this.className = className;
    }

    render(context: Context) {
        return h('span', {
            class: this.className,
        }, renderAny(this.children, context));
    }
}

function getRenderText(item: AuditLogPatchItem): any[] {
    const text: any[] = [
        item.key,
    ];

    if (item.type === AuditLogPatchItemType.Added) {
        text.push(' toegevoegd');
    }

    if (item.type === AuditLogPatchItemType.Removed) {
        text.push(' verwijderd');
    }

    if (item.type === AuditLogPatchItemType.Changed) {
        text.push(' aangepast');
    }

    if (item.type === AuditLogPatchItemType.Reordered) {
        text.push(' volgorde gewijzigd');
    }

    if ((item.oldValue && !isUuid(item.oldValue.value)) || (item.value && !isUuid(item.value.value))) {
        text.push(': ');

        const hasOld = item.oldValue && (item.oldValue.type || item.oldValue.value);
        const hasValue = item.value && (item.value.type || item.value.value);

        if (hasOld) {
            text.push(new TextWithClass(item.oldValue, 'style-value-old'));
        }

        if (hasOld && hasValue) {
            text.push(' → ');
        }

        if (hasValue) {
            text.push(new TextWithClass(item.value, 'style-value-new'));
        }
    }
    else {
        if (!item.type) {
            text.push(' aangepast');
        }
    }

    return text;
}

</script>

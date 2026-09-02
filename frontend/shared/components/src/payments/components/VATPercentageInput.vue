<template>
    <STInputBox v-if="invoicesEnabled || percentage !== null" error-fields="VATPercentage" :error-box="errorBox" :title="$t('%1Hu')" class="max">
        <template #right>
            <button v-if="!excempt" class="button text small" type="button" @click="toggleVATExcempt">
                <span>{{ $t('Verleggen') }}</span>
                <span class="icon arrow-down-small small" />
            </button>
        </template>

        <STList>
            <STListItem v-for="option in options" :key="option.value ?? 'none'" :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="percentage" :value="option.value" autocomplete="off" name="VATPercentage" />
                </template>
                <h4 class="style-list-title">
                    {{ option.name }}
                    <span v-if="percentage === option.value && excempt" class="style-tag inline-first">{{ $t('%1Hw') }}</span>
                </h4>
            </STListItem>
        </STList>
    </STInputBox>
    <p v-if="excempt" class="style-description-small">
        <I18nComponent :t="$t('%1Hx', {reden: getVATExcemptReasonName(excempt)})">
            <template #button="{content}">
                <button class="inline-link" type="button" @click="toggleVATExcempt">
                    {{ content }}
                </button>
            </template>
        </I18nComponent>
    </p>
</template>

<script lang="ts" setup>
import type { ErrorBox } from '#errors/ErrorBox.ts';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { getVATExcemptReasonName, VATExcemptReason } from '@stamhoofd/structures';

defineProps<{
    invoicesEnabled: boolean;
    errorBox: ErrorBox | null;
}>();

const percentage = defineModel<number | null>('percentage', { required: true });
const excempt = defineModel<VATExcemptReason | null>('excempt', { required: true });

const options = [
    { value: null, name: $t('%1Hv') },
    { value: 21, name: '21%' },
    { value: 12, name: '12%' },
    { value: 6, name: '6%' },
];

async function toggleVATExcempt(event: MouseEvent) {
    const reasons = [null, VATExcemptReason.IntraCommunityServices, VATExcemptReason.IntraCommunityGoods];
    const menu = new ContextMenu([
        reasons.map(reason => new ContextMenuItem({
            name: reason === null ? $t('%1Hy') : getVATExcemptReasonName(reason),
            selected: excempt.value === reason,
            action: () => {
                excempt.value = reason;
            },
        })),
    ]);
    await menu.show({ clickEvent: event });
}
</script>

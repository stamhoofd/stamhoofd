<template>
    <STListItem class="judicial-record-check-row left-center" :class="{'is-pending': isPending}">
        <template #left>
            <IconContainer :class="color" :icon="icon">
                <template #aside>
                    <ProgressIcon :icon="badge" />
                </template>
            </IconContainer>
        </template>

        <h3 class="style-title-list">
            {{ title }}
        </h3>
        <p v-if="reason" class="style-description-small">
            {{ reason }}
        </p>
    </STListItem>
</template>

<script setup lang="ts">
import IconContainer from '#icons/IconContainer.vue';
import ProgressIcon from '#icons/ProgressIcon.vue';
import STListItem from '#layout/STListItem.vue';
import { JudicialRecordCheckResult, JudicialRecordCheckStatus } from '@stamhoofd/structures';
import { computed } from 'vue';
import { getJudicialRecordCheckBadge, getJudicialRecordCheckColor, useJudicialRecordCheckTranslations } from './useJudicialRecordCheckTranslations';

const props = defineProps<{
    result: JudicialRecordCheckResult;

    /** The backend's sentence, or null when the row above already said it. */
    reason: string | null;
}>();

const { getTitle, getIcon } = useJudicialRecordCheckTranslations();

/**
 * The title is ours, the reason is the backend's. The checks lean on packages that already answer
 * with a sentence meant for whoever uploaded the file - which step of the signature refused it,
 * which limit a pdf did not fit - so re-wording that here would throw away the part that tells
 * someone what to do about it.
 */
const title = computed(() => getTitle(props.result.check));
const icon = computed(() => getIcon(props.result.check));
const color = computed(() => getJudicialRecordCheckColor(props.result.status));
const badge = computed(() => getJudicialRecordCheckBadge(props.result.status));
const isPending = computed(() => props.result.status === JudicialRecordCheckStatus.Pending);
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables" as *;

.judicial-record-check-row {
    &.is-pending > .main > div > .middle > h3 {
        color: $color-gray-text;
    }
}
</style>

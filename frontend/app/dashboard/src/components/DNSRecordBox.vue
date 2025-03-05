<template>
    <div>
        <dl class="details-grid dns-records" :class="{ success: record.status === 'Valid' }">
            <dt>{{ $t('b610d465-2901-4b54-97ae-dbeab72e4762') }}</dt>
            <dd>{{ record.type }}</dd>

            <dt>{{ $t('d32893b7-c9b0-4ea3-a311-90d29f2c0cf3') }}</dt>
            <dd v-tooltip="'Klik om te kopiëren'" v-copyable class="selectable">
                {{ record.name }}
            </dd>

            <dt>{{ $t('893b6eea-60d4-43ff-b363-52b25787386b') }}</dt>
            <dd v-tooltip="'Klik om te kopiëren'" v-copyable class="selectable">
                {{ record.value }}
            </dd>

            <dt>{{ $t('d782aa03-8e09-408d-912a-dabbd7b3dbeb') }}</dt>
            <dd v-copyable class="selectable">
                3600
            </dd>

            <span v-if="record.status === 'Valid'" class="icon green success"/>
            <span v-if="record.status === 'Failed'" class="icon error"/>
        </dl>
        <template v-if="record.errors">
            <div v-for="error in record.errors.errors" :key="error.id" class="error-box" style="word-wrap: break-word">
                {{ error.human || error.message }}
            </div>
        </template>
    </div>
</template>

<script lang="ts" setup>
import { DNSRecord } from '@stamhoofd/structures';

defineProps<{
    record: DNSRecord;
}>();
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.dns-records {
    padding: 20px 20px;
    margin: 15px 0;
    border-radius: $border-radius;
    background: $color-background-shade;

    &.success {
        background: $color-success-background;
        color: $color-success-dark;
    }

    display: grid;
    grid-template-columns: 20% 80%;
    gap: 8px 0;
    position: relative;

    @media (max-width: 450px) {
        margin: 15px calc(-1 * var(--st-horizontal-padding, 40px));
        padding: 20px var(--st-horizontal-padding, 40px);
    }

    dt {
        @extend .style-definition-term;
    }

    dd {
        @extend .style-definition-description;
        font-family: monospace;
        word-wrap: break-word;
        outline: 0;

        &.selectable {
            cursor: pointer;
        }
    }

    > .icon {
        position: absolute;
        right: 10px;
        top: 10px;
    }
}

</style>

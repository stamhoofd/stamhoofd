<template>
    <div>
        <dl class="details-grid dns-records" :class="{ success: record.status === 'Valid' }">
            <template v-if="record.optional">
                <dt>{{ $t('9e0461d2-7439-4588-837c-750de6946287') }}</dt>
                <dd>{{ $t('9abb03cf-d76c-4f97-afea-76982042b1ad') }}</dd>
            </template>

            <dt>{{ $t('6c9d45e5-c9f6-49c8-9362-177653414c7e') }}</dt>
            <dd>{{ record.type }}</dd>

            <dt>{{ $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') }}</dt>
            <dd v-copyable class="selectable" :v-tooltip="$t('6b0bca07-3cba-45cf-bc94-e3217e59a69f')">
                {{ record.name }}
            </dd>

            <dt>{{ $t('6a8b6166-a8f9-41b8-81e7-a12180de762e') }}</dt>
            <dd v-copyable class="selectable" :v-tooltip="$t('6b0bca07-3cba-45cf-bc94-e3217e59a69f')">
                {{ record.value }}
            </dd>

            <dt>{{ $t('116f6ca0-c077-4468-b79b-d329f6a8db77') }}</dt>
            <dd v-copyable class="selectable">
                3600
            </dd>

            <span v-if="record.status === 'Valid'" class="icon green success" />
            <span v-if="record.status === 'Failed'" class="icon error" />
        </dl>
        <div v-if="record.description" class="info-box" style="word-wrap: break-word">
            {{ record.description }}
        </div>
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

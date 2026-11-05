<template>
    <div v-if="isConfigured" class="container">
        <hr><h2>{{ $t('Uittreksel uit het strafregister') }}</h2>

        <STList>
            <STListItem>
                <h3 class="style-definition-label">
                    {{ JudicialRecordHelper.getStatusName(judicialRecord.status) }}
                </h3>
                <p class="style-definition-text">
                    {{ judicialRecord.description }}
                </p>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import type { PlatformMember } from '@stamhoofd/structures';
import { JudicialRecordHelper } from '@stamhoofd/structures';
import { computed } from 'vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();

const platform = usePlatform();
const organization = useOrganization();

/** Without a single responsibility asking for an extract, the whole question is irrelevant for this organization. */
const isConfigured = computed(() => {
    return [
        ...platform.value.config.responsibilities,
        ...(organization.value?.privateMeta?.responsibilities ?? []),
    ].some(r => r.judicialRecordMinimumAge !== null);
});

const judicialRecord = computed(() => props.member.judicialRecord);
</script>

<template>
    <SaveView :title="$t('d3cab6d1-af72-4d4c-b70b-6862d9843b37')" :save-text="$t('a3ea7b14-204b-44b9-abb5-8ced5fc847d1')" @save="goNext">
        <h1>
            {{ $t('860735a0-eb27-44ba-9364-4d52f0ce6698') }}
        </h1>
        <p>{{ $t('83877c6a-5330-4299-af39-fdbac4501dff') }}</p>

        <button v-if="!isCheckedAll" class="button text" type="button" @click="checkAll">
            {{ $t('6efc88ed-1512-4e17-91cd-b974ac298ddd') }}
        </button>
        <button v-else class="button text" type="button" @click="uncheckAll">
            {{ $t('38443a1a-edf6-4edd-b736-301bcb70cd9f') }}
        </button>

        <STList>
            <STListItem v-for="(match, index) in members" :key="index" element-name="label" :selectable="true">
                <div>
                    <h2 class="style-title-list">
                        {{ match.name }}
                    </h2>
                    <p class="style-description-small">
                        {{ match.birthDayFormatted || "/" }}
                    </p>
                </div>

                <template #right>
                    <div>
                        <h2 class="style-title-list">
                            {{ match.existingMember.member.details.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ match.existingMember.member.details.birthDayFormatted || "/" }}
                        </p>
                    </div>
                </template>

                <template #left>
                    <Checkbox :model-value="match.isEqual" @update:model-value="setEqual(match, $event)"/>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, PushOptions, useShow } from '@simonbackx/vue-app-navigation';
import { Checkbox, STList, STListItem } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { FindExistingMemberResult } from '../../../../../classes/import/FindExistingMemberResult';

const props = defineProps<{
    members: (FindExistingMemberResult & { readonly existingMember: PlatformMember })[];
    onVerified: (show: (options: PushOptions | ComponentWithProperties) => Promise<void>) => void;
}>();

const show = useShow();

const isCheckedAll = computed(() => {
    for (const member of props.members) {
        if (!member.isEqual) {
            return false;
        }
    }
    return true;
});

function goNext() {
    props.onVerified(show);
}

function checkAll() {
    for (const member of props.members) {
        member.markEqual();
    }
}

function uncheckAll() {
    for (const member of props.members) {
        member.markNotEqual();
    }
}

function setEqual(member: FindExistingMemberResult, value: boolean) {
    if (value) {
        member.markEqual();
    }
    else {
        member.markNotEqual();
    }
}
</script>

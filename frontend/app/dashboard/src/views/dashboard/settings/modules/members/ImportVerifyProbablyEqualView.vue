<template>
    <SaveView :title="$t('%1A4')" :save-text="$t('%19q')" @save="goNext">
        <h1>
            {{ $t('%1A5') }}
        </h1>
        <p>{{ $t('%1A6') }}</p>

        <button v-if="!isCheckedAll" class="button text" type="button" @click="checkAll">
            {{ $t('%1A7') }}
        </button>
        <button v-else class="button text" type="button" @click="uncheckAll">
            {{ $t('%1A8') }}
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
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
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

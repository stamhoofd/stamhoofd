<template>
    <SaveView :title="$t('Lijken op elkaar')" :save-text="$t('Volgende')" @save="goNext">
        <h1>
            {{ $t('Vink de rijen aan als het om dezelfde personen gaat') }}
        </h1>
        <p>{{ $t('We zijn niet 100% zeker dat deze leden uit Stamhoofd en jouw bestand op dezelfde persoon duiden (bv. door een typfout of een vergissing in de geboortedatum). Kan je dit manueel verifiëren? De linkse gegevens uit jouw bestand zullen de rechtse (= uit Stamhoofd) overschrijven als je ze aanvinkt.') }}</p>

        <button v-if="!isCheckedAll" class="button text" type="button" @click="checkAll">
            {{ $t('Alles aanvinken') }}
        </button>
        <button v-else class="button text" type="button" @click="uncheckAll">
            {{ $t('Alles uitvinken') }}
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

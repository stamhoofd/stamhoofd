<template>
    <div class="st-view">
        <STNavigationBar title="Lijken op elkaar" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Vink de rijen aan als het om dezelfde personen gaat
            </h1>
            <p>We zijn niet 100% zeker dat deze leden uit Stamhoofd en jouw bestand op dezelfde persoon duiden (bv. door een typfout of een vergissing in de geboortedatum). Kan je dit manueel verifiëren? De linkse gegevens uit jouw bestand zullen de rechtse (= uit Stamhoofd) overschrijven als je ze aanvinkt.</p>

            <button v-if="!isCheckedAll" class="button text" type="button" @click="checkAll">
                Alles aanvinken
            </button>
            <button v-else class="button text" type="button" @click="uncheckAll">
                Alles uitvinken
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
                        <Checkbox :model-value="match.isEqual" @update:model-value="setEqual(match, $event)" />
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="goNext">
                    Verder
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, PushOptions, useCanDismiss, useCanPop, useShow } from '@simonbackx/vue-app-navigation';
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { ExistingMemberResult } from '../../../../../classes/import/ExistingMemberResult';

const props = defineProps<{
    members: (ExistingMemberResult & { readonly existingMember: PlatformMember })[];
    onVerified: (show: (options: PushOptions | ComponentWithProperties) => Promise<void>) => void;
}>();

const canDismiss = useCanDismiss();
const canPop = useCanPop();
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

function setEqual(member: ExistingMemberResult, value: boolean) {
    if (value) {
        member.markEqual();
    }
    else {
        member.markNotEqual();
    }
}
</script>

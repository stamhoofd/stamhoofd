<template>
    <div v-if="familyMembers.length > 0" class="hover-box container">
        <hr><h2>
            <template v-if="member.patchedMember.details.defaultAge <= 30 && Math.abs(maxFamilyAge - member.patchedMember.details.defaultAge) <= 14">
                {{ $t('9bc4abf4-e439-4992-a32e-79a1553af72e') }}
            </template>
            <template v-else>
                {{ $t('ba70e3cd-ccdb-4742-b6c9-50bdd1c73da0') }}
            </template>
        </h2>

        <STList>
            <STListItem v-for="familyMember in familyMembers" :key="familyMember.id" :selectable="true" @click="gotoMember(familyMember)">
                <template #left>
                    <span class="icon user small" />
                </template>
                <h3 class="style-title-list">
                    {{ familyMember.patchedMember.firstName }} {{ familyMember.patchedMember.details ? familyMember.patchedMember.details.lastName : "" }}
                </h3>
                <p class="style-description-small">
                    {{ familyMember.registrationDescription }}
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { MemberSegmentedView } from '../..';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();
const present = usePresent();

const familyMembers = computed(() => props.member.family.members.filter(m => m.id !== props.member.id));
const maxFamilyAge = computed(() => {
    const ages = familyMembers.value.map(m => m.patchedMember.details.age ?? 99);
    if (ages.length === 0) {
        return 99;
    }
    return Math.max(...ages);
});

async function gotoMember(member: PlatformMember) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(MemberSegmentedView, {
                    member,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>

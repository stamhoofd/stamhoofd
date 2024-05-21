<template>
    <div class="member-view-details split">
        <div>
            <ViewMemberWarningsBox v-if="isMobile" :member="member" />
            <ViewMemberGeneralBox :member="member" />
            <MemberRegistrationsBox :member="member" />
            <ViewMemberParentsBox :member="member" />
            <ViewMemberEmergencyContactsBox :member="member" />
        </div>

        <div>
            <ViewMemberWarningsBox v-if="!isMobile" :member="member" />

            <div v-if="member.patchedMember.users.length > 0" class="hover-box container">
                <hr>
                <h2 class="style-with-button">
                    <span class="icon-spacer">Accounts</span>
                    <a 
                        v-if="!$isTouch"
                        class="button icon gray help"
                        target="_blank"
                        :href="'https://'+$t('shared.domains.marketing')+'/docs/leden-beheren-met-meerdere-ouders/'"
                    />
                </h2>

                <STList>
                    <STListItem v-for="user in member.patchedMember.users" :key="user.id" class="hover-box">
                        <template v-if="user.hasAccount && user.verified" #left>
                            <span class="icon user small" />
                        </template>
                        <template v-else-if="user.hasAccount && !user.verified" #left>
                            <span v-tooltip="'Deze gebruiker moet het e-mailadres nog verifiëren.'" class="icon email small" />
                        </template>
                        <template v-else #left>
                            <span v-tooltip="'Deze gebruiker moet eerst registreren op dit emailadres en daarbij een wachtwoord instellen.'" class="icon email small" />
                        </template>

                        <template v-if="user.firstName || user.lastName">
                            <h3 v-if="user.firstName || user.lastName" class="style-title-list">
                                {{ user.firstName }} {{ user.lastName }}
                            </h3>
                            <p class="style-description-small">
                                {{ user.email }}
                            </p>
                        </template>
                        <h3 v-else class="style-title-list">
                            {{ user.email }}
                        </h3>

                        <p v-if="!user.hasAccount" class="style-description-small">
                            Kan registreren
                        </p>

                        <p v-else-if="!user.verified" class="style-description-small">
                            E-mailadres nog niet geverifieerd
                        </p>

                        <p v-if="user.permissions" class="style-description-small">
                            Beheerder
                        </p>

                        <template #right>
                            <button class="button icon trash hover-show" type="button" :disabled="member.isSaving" @click="unlinkUser(user)" />
                        </template>
                    </STListItem>
                </STList>
            </div>

            <div v-if="familyMembers.length > 0" class="hover-box container">
                <hr>
                <h2>
                    <template v-if="member.patchedMember.details.defaultAge <= 30 && Math.abs(maxFamilyAge - member.patchedMember.details.defaultAge) <= 14">
                        Broers &amp; zussen
                    </template>
                    <template v-else>
                        Familie
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
                        <p v-if="familyMember.groups.length > 0" class="style-description-small">
                            {{ familyMember.groups.map(g => g.settings.name).join(", ") }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Toast, useIsMobile, usePlatformFamilyManager } from '@stamhoofd/components';
import { PlatformMember, User } from '@stamhoofd/structures';
import { computed } from 'vue';
import MemberSegmentedView from '../MemberSegmentedView.vue';
import MemberRegistrationsBox from '../components/MemberRegistrationsBox.vue';
import ViewMemberEmergencyContactsBox from '../components/view/ViewMemberEmergencyContactsBox.vue';
import ViewMemberGeneralBox from '../components/view/ViewMemberGeneralBox.vue';
import ViewMemberParentsBox from '../components/view/ViewMemberParentsBox.vue';
import ViewMemberWarningsBox from '../components/view/ViewMemberWarningsBox.vue';

const isMobile = useIsMobile();
const present = usePresent();
const platformFamilyManager = usePlatformFamilyManager();

const props = defineProps<{
    member: PlatformMember
}>();

const familyMembers = computed(() => props.member.family.members.filter(m => m.id !== props.member.id))
const maxFamilyAge = computed(() => {
    const ages = familyMembers.value.map(m => m.patchedMember.details.age ?? 99)
    if (ages.length == 0) {
        return 99
    }
    return Math.max(...ages)
})

async function gotoMember(member: PlatformMember) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(MemberSegmentedView, {
                    member,
                }),
            })
        ],
        modalDisplayStyle: "popup"
    });
}

async function unlinkUser(user: User) {
    if (!await CenteredMessage.confirm("Ben je zeker dat je de toegang tot dit lid wilt intrekken voor dit account?", "Ja, verwijderen", "Toegang intrekken van: "+user.email)) {
        return
    }

    try {
        const missing: PatchableArrayAutoEncoder<User> = new PatchableArray()
        missing.addDelete(user.id)

        props.member.addPatch({
            users: missing
        })

        await platformFamilyManager.save([props.member])
    } catch (e) {
        // Reset
        console.error(e)
        Toast.fromError(e).show()
    }
}

</script>

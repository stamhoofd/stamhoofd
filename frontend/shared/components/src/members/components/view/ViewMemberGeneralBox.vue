<template>
    <div class="hover-box container">
        <hr>
        <dl class="details-grid hover">
            <template v-if="member.patchedMember.details.name">
                <dt>Naam</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.name }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.memberNumber">
                <dt>Lidnummer</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.memberNumber }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.birthDay">
                <dt>Verjaardag</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.birthDayFormatted }} ({{ member.patchedMember.details.age }} jaar)
                </dd>
            </template>

            <template v-if="platformHasResponsibilities">
                <dt>Functies</dt>
                <dd class="with-icons button" @click="editResponsibilities">
                    {{ responsibilitiesText }}

                    <span class="icon edit gray" />
                </dd>
            </template>

            <template v-if="member.patchedMember.details.phone">
                <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.phone }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.email">
                <dt>E-mailadres {{ member.patchedMember.details.alternativeEmails.length ? '1' : ''}}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.email }}
                </dd>
            </template>

            <template v-for="(email, index) of member.patchedMember.details.alternativeEmails" :key="index">
                <dt>E-mailadres {{ index + 2 }}</dt>
                <dd v-copyable>
                    {{ email }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.address">
                <dt>Adres</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.address.street }} {{ member.patchedMember.details.address.number }}<br>{{ member.patchedMember.details.address.postalCode }}
                    {{ member.patchedMember.details.address.city }}
                    <template v-if="member.patchedMember.details.address.country !== currentCountry">
                        <br>{{ formatCountry(member.patchedMember.details.address.country) }}
                    </template>
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useCountry, useOrganization, usePlatform } from '../../../hooks';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>()

const currentCountry = useCountry();
const platform = usePlatform()
const organization = useOrganization()
const platformHasResponsibilities = computed(() => platform.value.config.responsibilities.length > 0 && (props.member.patchedMember.details.defaultAge >= 16 || responsibilities.value.length))
const responsibilities = computed(() => {
    return props.member.patchedMember.responsibilities.filter(r => r.endDate === null && (organization.value === null || r.organizationId === organization.value.id)).map(r => platform.value.config.responsibilities.find(rr => rr.id === r.responsibilityId)?.name ?? 'Onbekend');
})

const responsibilitiesText = computed(() => {
    if (responsibilities.value.length === 0) {
        return 'Geen'
    }
    return Formatter.joinLast(responsibilities.value, ', ', ' en ')
})

function editResponsibilities() {
    // todo
}

</script>

<template>
    <div class="hover-box container">
        <hr><dl class="details-grid">
            <template v-if="member.patchedMember.details.name">
                <dt>{{ $t('%1Os') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.name }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.memberNumber">
                <dt>{{ $t('%19j') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.memberNumber }}</span>
                </dd>
            </template>

            <template v-if="showSGVSyncStatus">
                <dt>{{ $t('Gesynchroniseerd') }}</dt>
                <dd>
                    <span v-tooltip="$t('Leden moeten na wijzigingen opnieuw gesynchroniseerd worden met Scouts en Gidsen Vlaanderen.')" class="style-tooltip">
                        {{ sgvSyncDate }}
                    </span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.birthDay">
                <dt>{{ $t('%fn') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.birthDayFormatted }}</span> {{ $t('%fo', {age: member.patchedMember.details.age === null ? '' : member.patchedMember.details.age.toString()}) }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.trackingYear">
                <dt>{{ $t('%7w') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.trackingYear }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.phone">
                <dt>{{ $t('%2k') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.phone }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.email">
                <dt>{{ $t('%1FK') }} {{ member.patchedMember.details.alternativeEmails.length ? '1' : '' }}</dt>
                <dd>
                    <EmailAddress :email="props.member.patchedMember.details.email" />
                </dd>
            </template>

            <template v-for="(email, index) of member.patchedMember.details.alternativeEmails" :key="index">
                <dt>{{ $t('%1FK') }} {{ index + 2 }}</dt>
                <dd>
                    <EmailAddress :email="email" />
                </dd>
            </template>

            <template v-if="member.patchedMember.details.address">
                <dt>{{ $t('%Cn') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">
                        {{ member.patchedMember.details.address.street }} {{ member.patchedMember.details.address.number }}<br>
                        {{ member.patchedMember.details.address.postalCode }} {{ member.patchedMember.details.address.city }}
                        <template v-if="member.patchedMember.details.address.country !== currentCountry">
                            <br>{{ formatCountry(member.patchedMember.details.address.country) }}
                        </template>
                    </span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.uitpasNumberDetails">
                <dt>{{ $t('%wF') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.uitpasNumberDetails.uitpasNumber }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.nationalRegisterNumber && member.patchedMember.details.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>{{ $t('%wK') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.nationalRegisterNumber }}</span>
                </dd>
            </template>

            <template v-if="member.member.createdAt">
                <dt>{{ $t('%1Jc') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ formatDate(member.member.createdAt, true) }}</span>
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import type { PlatformMember } from '@stamhoofd/structures';
import { isSGVManagedMember, NationalRegisterNumberOptOut, OrganizationType, UmbrellaOrganization } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useCountry } from '../../../hooks';
import { useOrganization } from '../../../hooks/useOrganization';
import EmailAddress from '../../../email/EmailAddress.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();

const currentCountry = useCountry();
const organization = useOrganization();
const isSGVOrganization = computed(() => organization.value?.meta.type === OrganizationType.Youth && organization.value.meta.umbrellaOrganization === UmbrellaOrganization.ScoutsEnGidsenVlaanderen);
const showSGVSyncStatus = computed(() => isSGVOrganization.value && (isSGVManagedMember(props.member.member) || !!props.member.patchedMember.details.lastExternalSync));
const sgvSyncDate = computed(() => props.member.patchedMember.details.lastExternalSync ? Formatter.date(props.member.patchedMember.details.lastExternalSync, true) : $t('Nooit'));
</script>

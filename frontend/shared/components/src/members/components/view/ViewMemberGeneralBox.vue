<template>
    <div class="hover-box container">
        <hr><dl class="details-grid hover">
            <template v-if="member.patchedMember.details.name">
                <dt>{{ $t('Naam') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.name }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.memberNumber">
                <dt>{{ $t('Lidnummer') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.memberNumber }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.birthDay">
                <dt>{{ $t('Verjaardag') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.birthDayFormatted }} {{ $t('({age} jaar)', {age: member.patchedMember.details.age === null ? '' : member.patchedMember.details.age.toString()}) }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.trackingYear">
                <dt>{{ $t('99b87ddc-3a72-45fa-923a-10bf130fb4de') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.trackingYear }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.phone">
                <dt>{{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.phone }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.email">
                <dt>{{ $t('E-mailadres') }} {{ member.patchedMember.details.alternativeEmails.length ? '1' : '' }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.email }}
                </dd>
            </template>

            <template v-for="(email, index) of member.patchedMember.details.alternativeEmails" :key="index">
                <dt>{{ $t('E-mailadres') }} {{ index + 2 }}</dt>
                <dd v-copyable>
                    {{ email }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.address">
                <dt>{{ $t('Adres') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.address.street }} {{ member.patchedMember.details.address.number }}<br><template v-if="member.patchedMember.details.address.country !== currentCountry">
                        <br>
                    </template>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.uitpasNumber">
                <dt>{{ $t('UiTPAS-nummer') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.uitpasNumber }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.nationalRegisterNumber && member.patchedMember.details.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>{{ $t('Rijksregisternummer') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.nationalRegisterNumber }}
                </dd>
            </template>

            <template v-if="member.member.createdAt">
                <dt>{{ $t('Aanmaakdatum') }}</dt>
                <dd v-copyable>
                    {{ formatDate(member.member.createdAt, true) }}
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { NationalRegisterNumberOptOut, PlatformMember } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';

defineOptions({
    inheritAttrs: false,
});

defineProps<{
    member: PlatformMember;
}>();

const currentCountry = useCountry();
</script>

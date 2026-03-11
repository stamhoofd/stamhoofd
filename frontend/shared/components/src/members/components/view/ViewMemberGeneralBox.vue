<template>
    <div class="hover-box container">
        <hr><dl class="details-grid">
            <template v-if="member.patchedMember.details.name">
                <dt>{{ $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.name }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.memberNumber">
                <dt>{{ $t('123be534-a0be-4a6e-b03f-021659e1d8ba') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.memberNumber }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.birthDay">
                <dt>{{ $t('ff14d4f3-7664-4226-b895-55ba915042e2') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.birthDayFormatted }}</span> {{ $t('47199bdb-258f-480a-b124-a418cce2dfcf', {age: member.patchedMember.details.age === null ? '' : member.patchedMember.details.age.toString()}) }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.trackingYear">
                <dt>{{ $t('99b87ddc-3a72-45fa-923a-10bf130fb4de') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.trackingYear }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.phone">
                <dt>{{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.phone }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.email">
                <dt>{{ $t('237d0720-13f0-4029-8bf2-4de7e0a9a358') }} {{ member.patchedMember.details.alternativeEmails.length ? '1' : '' }}</dt>
                <dd>
                    <EmailAddress :email="props.member.patchedMember.details.email" />
                </dd>
            </template>

            <template v-for="(email, index) of member.patchedMember.details.alternativeEmails" :key="index">
                <dt>{{ $t('237d0720-13f0-4029-8bf2-4de7e0a9a358') }} {{ index + 2 }}</dt>
                <dd>
                    <EmailAddress :email="email" />
                </dd>
            </template>

            <template v-if="member.patchedMember.details.address">
                <dt>{{ $t('0a37de09-120b-4bea-8d13-6d7ed6823884') }}</dt>
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
                <dt>{{ $t('87c1a48c-fef5-44c3-ae56-c83463fcfb84') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.uitpasNumberDetails.uitpasNumber }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.nationalRegisterNumber && member.patchedMember.details.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>{{ $t('00881b27-7501-4c56-98de-55618be2bf11') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.nationalRegisterNumber }}</span>
                </dd>
            </template>

            <template v-if="member.member.createdAt">
                <dt>{{ $t('6711ac76-e8c7-482b-b6b4-635ba3d16f60') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ formatDate(member.member.createdAt, true) }}</span>
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { NationalRegisterNumberOptOut, PlatformMember } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';
import EmailAddress from '../../../email/EmailAddress.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();

const currentCountry = useCountry();
</script>

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
                <dt>{{ $t('ee10afe3-2dd4-4fa1-98bc-0e1372903fed') }}</dt>
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
                <dt>{{ $t('7400cdce-dfb4-40e7-996b-4817385be8d8') }} {{ member.patchedMember.details.alternativeEmails.length ? '1' : '' }}</dt>
                <dd>
                    <EmailAddress :email="props.member.patchedMember.details.email" />
                </dd>
            </template>

            <template v-for="(email, index) of member.patchedMember.details.alternativeEmails" :key="index">
                <dt>{{ $t('7400cdce-dfb4-40e7-996b-4817385be8d8') }} {{ index + 2 }}</dt>
                <dd>
                    <EmailAddress :email="email" />
                </dd>
            </template>

            <template v-if="member.patchedMember.details.address">
                <dt>{{ $t('f7e792ed-2265-41e9-845f-e3ce0bc5da7c') }}</dt>
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
                <dt>{{ $t('d70f2a7f-d8b4-4846-8dc0-a8e978765b9d') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.uitpasNumberDetails.uitpasNumber }}</span>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.nationalRegisterNumber && member.patchedMember.details.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>{{ $t('439176a5-dd35-476b-8c65-3216560cac2f') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ member.patchedMember.details.nationalRegisterNumber }}</span>
                </dd>
            </template>

            <template v-if="member.member.createdAt">
                <dt>{{ $t('c38e774e-e8ab-4549-b119-4eed380c626c') }}</dt>
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

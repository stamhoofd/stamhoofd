<template>
    <div class="hover-box container">
        <hr><dl class="details-grid hover">
            <template v-if="member.patchedMember.details.name">
                <dt>{{ $t('d32893b7-c9b0-4ea3-a311-90d29f2c0cf3') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.name }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.memberNumber">
                <dt>{{ $t('c2e23ef9-74d7-4b81-a052-e24ffcdfa0d9') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.memberNumber }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.birthDay">
                <dt>{{ $t('8c580eed-b9dc-4ecb-9a06-9401fb311efd') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.birthDayFormatted }} ({{ member.patchedMember.details.age }} {{ $t('7c73a740-4370-405d-b769-855ea1af126c') }}
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
                <dt>{{ $t('0be79160-b242-44dd-94f0-760093f7f9f2') }} {{ member.patchedMember.details.alternativeEmails.length ? '1' : '' }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.email }}
                </dd>
            </template>

            <template v-for="(email, index) of member.patchedMember.details.alternativeEmails" :key="index">
                <dt>{{ $t('0be79160-b242-44dd-94f0-760093f7f9f2') }} {{ index + 2 }}</dt>
                <dd v-copyable>
                    {{ email }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.address">
                <dt>{{ $t('e6dc987c-457b-4253-9eef-db9ccdb774f1') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.address.street }} {{ member.patchedMember.details.address.number }}<br><template v-if="member.patchedMember.details.address.country !== currentCountry">
                        <br></template>
                </dd>
            </template>

            <template v-if="member.patchedMember.details.uitpasNumber">
                <dt>{{ $t('398b3c2b-8c53-48aa-812b-dfaae54157bd') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.uitpasNumber }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.nationalRegisterNumber && member.patchedMember.details.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>{{ $t('642e4034-71e5-4d00-a6f4-b7dbcc39aac0') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.nationalRegisterNumber }}
                </dd>
            </template>

            <template v-if="member.member.createdAt">
                <dt>{{ $t('2e2c1024-3ad7-488b-90f4-1d94efbde9e7') }}</dt>
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

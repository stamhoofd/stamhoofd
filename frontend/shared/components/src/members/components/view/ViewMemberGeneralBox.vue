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

            <template v-if="member.patchedMember.details.phone">
                <dt>{{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.phone }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.email">
                <dt>E-mailadres {{ member.patchedMember.details.alternativeEmails.length ? '1' : '' }}</dt>
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

            <template v-if="member.patchedMember.details.uitpasNumber">
                <dt>UiTPAS-nummer</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.uitpasNumber }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.nationalRegisterNumber">
                <dt>Rijksregisternummer</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.nationalRegisterNumber }}
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';

defineOptions({
    inheritAttrs: false,
});

defineProps<{
    member: PlatformMember;
}>();

const currentCountry = useCountry();
</script>

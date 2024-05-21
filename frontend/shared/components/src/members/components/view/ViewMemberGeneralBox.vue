<template>
    <div class="hover-box container">
        <dl class="details-grid hover">
            <template v-if="!member.isNew && app === 'admin'">
                <dt>ID</dt>
                <dd v-copyable>
                    {{ member.patchedMember.id }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.firstName">
                <dt>Voornaam</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.firstName }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.lastName">
                <dt>Achternaam</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.lastName }}
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
                <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.phone }}
                </dd>
            </template>

            <template v-if="member.patchedMember.details.email">
                <dt>E-mailadres</dt>
                <dd v-copyable>
                    {{ member.patchedMember.details.email }}
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
import { useCountry } from '../../../hooks';
import { useAppContext } from '../../../context/appContext';

defineOptions({
    inheritAttrs: false
})

defineProps<{
    member: PlatformMember
}>()

const app = useAppContext();
const currentCountry = useCountry();

</script>

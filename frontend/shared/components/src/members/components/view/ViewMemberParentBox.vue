<template>
    <div class="hover-box container">
        <hr>
        <h2 class="style-with-button">
            <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
        </h2>

        <dl class="details-grid hover">
            <dt>Naam</dt>
            <dd v-copyable>
                {{ parent.name }}
            </dd>

            <template v-if="parent.phone">
                <dt>{{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}</dt>
                <dd v-copyable>
                    {{ parent.phone }}
                </dd>
            </template>

            <template v-if="parent.email">
                <dt>E-mailadres {{ parent.alternativeEmails.length ? '1' : '' }}</dt>
                <dd v-copyable>
                    {{ parent.email }}
                </dd>
            </template>

            <template v-for="(email, index) of parent.alternativeEmails" :key="index">
                <dt>E-mailadres {{ index + 2 }}</dt>
                <dd v-copyable>
                    {{ email }}
                </dd>
            </template>

            <template v-if="parent.address">
                <dt>Adres</dt>
                <dd v-copyable>
                    {{ parent.address.street }} {{ parent.address.number }}<br>{{ parent.address.postalCode }}
                    {{ parent.address.city }}
                    <template v-if="parent.address.country !== currentCountry">
                        <br>{{ formatCountry(parent.address.country) }}
                    </template>
                </dd>
            </template>

            <template v-if="parent.nationalRegisterNumber && parent.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>Rijksregisternummer</dt>
                <dd v-copyable>
                    {{ parent.nationalRegisterNumber }}
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { Parent, PlatformMember, ParentTypeHelper, NationalRegisterNumberOptOut } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';

defineOptions({
    inheritAttrs: false,
});

defineProps<{
    parent: Parent;
    member: PlatformMember;
}>();

const currentCountry = useCountry();

</script>

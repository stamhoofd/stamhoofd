<template>
    <div class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
        </h2>

        <dl class="details-grid">
            <dt>{{ $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') }}</dt>
            <dd>
                <span v-copyable class="style-copyable">{{ parent.name }}</span>
            </dd>

            <template v-if="parent.phone">
                <dt>{{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ parent.phone }}</span>
                </dd>
            </template>

            <template v-if="parent.email">
                <dt>{{ $t('237d0720-13f0-4029-8bf2-4de7e0a9a358') }} {{ parent.alternativeEmails.length ? '1' : '' }}</dt>
                <dd>
                    <EmailAddress :email="parent.email" />
                </dd>
            </template>

            <template v-for="(email, index) of parent.alternativeEmails" :key="index">
                <dt>{{ $t('237d0720-13f0-4029-8bf2-4de7e0a9a358') }} {{ index + 2 }}</dt>
                <dd>
                    <EmailAddress :email="email" />
                </dd>
            </template>

            <template v-if="parent.address">
                <dt>{{ $t('0a37de09-120b-4bea-8d13-6d7ed6823884') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">
                        {{ parent.address.street }} {{ parent.address.number }}<br>
                        {{ parent.address.postalCode }} {{ parent.address.city }}
                        <template v-if="parent.address.country !== currentCountry">
                            <br>{{ formatCountry(parent.address.country) }}
                        </template>
                    </span>
                </dd>
            </template>

            <template v-if="parent.nationalRegisterNumber && parent.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>{{ $t('00881b27-7501-4c56-98de-55618be2bf11') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ parent.nationalRegisterNumber }}</span>
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { NationalRegisterNumberOptOut, Parent, ParentTypeHelper, PlatformMember } from '@stamhoofd/structures';
import EmailAddress from '../../../email/EmailAddress.vue';
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

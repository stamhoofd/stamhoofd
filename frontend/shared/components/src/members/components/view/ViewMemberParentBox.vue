<template>
    <div class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
        </h2>

        <dl class="details-grid hover">
            <dt>{{ $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') }}</dt>
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
                <dt>{{ $t('7400cdce-dfb4-40e7-996b-4817385be8d8') }} {{ parent.alternativeEmails.length ? '1' : '' }}</dt>
                <EmailDetailWithWarning tag="dd" :email="parent.email" />
            </template>

            <template v-for="(email, index) of parent.alternativeEmails" :key="index">
                <dt>{{ $t('7400cdce-dfb4-40e7-996b-4817385be8d8') }} {{ index + 2 }}</dt>
                <EmailDetailWithWarning tag="dd" :email="email" />
            </template>

            <template v-if="parent.address">
                <dt>{{ $t('f7e792ed-2265-41e9-845f-e3ce0bc5da7c') }}</dt>
                <dd v-copyable>
                    {{ parent.address.street }} {{ parent.address.number }}<br>
                    {{ parent.address.postalCode }} {{ parent.address.city }}
                    <template v-if="parent.address.country !== currentCountry">
                        <br>{{ formatCountry(parent.address.country) }}
                    </template>
                </dd>
            </template>

            <template v-if="parent.nationalRegisterNumber && parent.nationalRegisterNumber !== NationalRegisterNumberOptOut">
                <dt>{{ $t('439176a5-dd35-476b-8c65-3216560cac2f') }}</dt>
                <dd v-copyable>
                    {{ parent.nationalRegisterNumber }}
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { NationalRegisterNumberOptOut, Parent, ParentTypeHelper, PlatformMember } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';
import EmailDetailWithWarning from '../detail/EmailDetailWithWarning.vue';

defineOptions({
    inheritAttrs: false,
});

defineProps<{
    parent: Parent;
    member: PlatformMember;
}>();

const currentCountry = useCountry();

</script>

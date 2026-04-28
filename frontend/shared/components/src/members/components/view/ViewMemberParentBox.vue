<template>
    <div class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
        </h2>

        <dl class="details-grid">
            <dt>{{ $t('%1Os') }}</dt>
            <dd>
                <span v-copyable class="style-copyable">{{ parent.name }}</span>
            </dd>

            <template v-if="parent.phone">
                <dt>{{ $t('%2k') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ parent.phone }}</span>
                </dd>
            </template>

            <template v-if="parent.email">
                <dt>{{ $t('%1FK') }} {{ parent.alternativeEmails.length ? '1' : '' }}</dt>
                <dd>
                    <EmailAddress :email="parent.email" />
                </dd>
            </template>

            <template v-for="(email, index) of parent.alternativeEmails" :key="index">
                <dt>{{ $t('%1FK') }} {{ index + 2 }}</dt>
                <dd>
                    <EmailAddress :email="email" />
                </dd>
            </template>

            <template v-if="parent.address">
                <dt>{{ $t('%Cn') }}</dt>
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
                <dt>{{ $t('%wK') }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ parent.nationalRegisterNumber }}</span>
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import type { Parent, PlatformMember } from '@stamhoofd/structures';
import { NationalRegisterNumberOptOut, ParentTypeHelper } from '@stamhoofd/structures';
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

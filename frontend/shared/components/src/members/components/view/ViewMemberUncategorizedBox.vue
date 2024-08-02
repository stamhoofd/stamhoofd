<template>
    <div v-if="shouldShow">
        <div class="hover-box container">
            <hr>
            <h2 class="style-with-button"><div>Niet-toegekende gegevens</div></h2>

            <dl class="details-grid hover">
            <template v-for="(email, index) of uncategorizedEmails">
                <dt>E-mailadres {{ uncategorizedEmails.length > 1 ? index + 1 : ''}}</dt>
                    <dd v-copyable>
                        {{ email }}
                    </dd>
            </template>

            <template v-for="(phone, index) of uncategorizedPhones">
                <dt>{{ $t('shared.inputs.mobile.label') }} {{ uncategorizedPhones.length > 1 ? index + 1 : '' }}</dt>
                <dd v-copyable>
                    {{ phone }}
                </dd>
            </template>

            <template v-for="(address, index) of uncategorizedAddresses">
                <dt>Adres {{ uncategorizedAddresses.length > 1 ? index + 1 : '' }}</dt>
                <dd v-copyable>
                    {{ address.street }} {{ address.number }}<br>{{ address.postalCode }}
                    {{ address.city }}
                    <template v-if="address.country !== currentCountry">
                        <br>{{ formatCountry(address.country) }}
                    </template>
                </dd>
            </template>
        </dl>
        </div>  
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useCountry } from '../../../hooks';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>()

const currentCountry = useCountry();

const memberDetails = computed(() => props.member.patchedMember.details);
const uncategorizedAddresses = computed(() => memberDetails.value.uncategorizedAddresses ?? []);
const uncategorizedPhones = computed(() => memberDetails.value.uncategorizedPhones ?? []);
const uncategorizedEmails = computed(() => memberDetails.value.uncategorizedEmails ?? []);
const shouldShow = computed(() => uncategorizedAddresses.value.length > 0 || uncategorizedPhones.value.length > 0 || uncategorizedEmails.value.length > 0);
</script>

<template>
    <div class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ emergencyContact.title || emergencyContact.name }}</div>
        </h2>

        <dl class="details-grid hover">
            <dt>{{ $t('d32893b7-c9b0-4ea3-a311-90d29f2c0cf3') }}</dt>
            <dd v-copyable>
                {{ emergencyContact.name }}
            </dd>

            <dt>{{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}</dt>
            <dd v-copyable>
                {{ emergencyContact.phone }}
            </dd>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { EmergencyContact, PlatformMember } from '@stamhoofd/structures';
import { useCountry } from '../../../hooks';

defineOptions({
    inheritAttrs: false
})

defineProps<{
    emergencyContact: EmergencyContact,
    member: PlatformMember
}>()

</script>

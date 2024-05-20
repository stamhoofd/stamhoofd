<template>
    <div class="hover-box container">
        <hr>
        <h2 class="style-with-button">
            <div>{{ emergencyContact.title || emergencyContact.name }}</div>
        </h2>

        <dl class="details-grid hover">
            <dt>Naam</dt>
            <dd v-copyable>
                {{ emergencyContact.name }}
            </dd>

            <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
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

<template>
    <div class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ emergencyContact.title || emergencyContact.name }}</div>
        </h2>

        <dl class="details-grid hover">
            <dt>{{ $t('Naam') }}</dt>
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

defineOptions({
    inheritAttrs: false,
});

defineProps<{
    emergencyContact: EmergencyContact;
    member: PlatformMember;
}>();

</script>

<template>
    <div v-if="isAdmin" class="container">
        <component :is="level === 1 ? 'h1' : 'h2'">
            {{ title }}
        </component>

        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox v-model="dataPermissions">
            Er werd toestemming gegeven
        </Checkbox>

        <p v-if="dataPermissionsChangeDate" class="style-description-small">
            Laatst gewijzigd op {{ formatDate(dataPermissionsChangeDate) }}
        </p>
    </div>
    <div v-else class="container">
        <component :is="level === 1 ? 'h1' : 'h2'">
            {{ title }}
        </component>
        <p class="style-description pre-wrap" v-text="description" />
            
        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox v-model="dataPermissions">
            {{ checkboxLabel }}
        </Checkbox>
    </div>
</template>

<script setup lang="ts">
import { BooleanStatus, DataPermissionsSettings, PlatformMember } from '@stamhoofd/structures';

import { computed } from 'vue';
import { useAppContext } from '../../context/appContext';
import { Validator } from '../../errors/Validator';
import { useErrors } from '../../errors/useErrors';

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    level?: number
}>();

const errors = useErrors({validator: props.validator});
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';

const dataPermissions = computed({
    get: () => props.member.patchedMember.details.dataPermissions?.value ?? false,
    set: (dataPermissions) => {
        if (dataPermissions === (props.member.member.details.dataPermissions?.value ?? false)) {
            return props.member.addDetailsPatch({
                dataPermissions: props.member.member.details.dataPermissions ?? null
            })
        }
        return props.member.addDetailsPatch({
            dataPermissions: BooleanStatus.create({
                value: dataPermissions
            })
        })
    }
});
const dataPermissionsChangeDate = computed(() => props.member.patchedMember.details.dataPermissions?.date ?? null);

const configuration = computed(() => {
    return props.member.platform.config.recordsConfiguration.dataPermission ?? props.member.organizations.find(o => o.meta.recordsConfiguration.dataPermission)?.meta.recordsConfiguration.dataPermission ?? null
});
const title = computed(() => configuration.value?.title ?? DataPermissionsSettings.defaultTitle);
const description = computed(() => configuration.value?.description ?? DataPermissionsSettings.defaultDescription);
const checkboxLabel = computed(() => configuration.value?.checkboxLabel ?? DataPermissionsSettings.defaultCheckboxLabel);

</script>

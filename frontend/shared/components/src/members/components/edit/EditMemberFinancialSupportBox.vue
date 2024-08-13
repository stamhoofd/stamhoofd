<template>
    <div v-if="isAdmin" class="container">
        <Title v-bind="$attrs" :title="title" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox v-model="requiresFinancialSupport">
            {{ checkboxLabel }}
        </Checkbox>

        <p v-if="dataPermissionsChangeDate" class="style-description-small">
            Laatst gewijzigd op {{ formatDate(dataPermissionsChangeDate) }}
        </p>
    </div>
    <div v-else class="container">
        <Title v-bind="$attrs" :title="title" />
        <p class="style-description pre-wrap" v-text="description" />
            
        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox v-model="requiresFinancialSupport">
            {{ checkboxLabel }}
        </Checkbox>
    </div>
</template>

<script setup lang="ts">
import { BooleanStatus, FinancialSupportSettings, PlatformMember } from '@stamhoofd/structures';

import { computed, nextTick } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null
}>();

const errors = useErrors({validator: props.validator});
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const markReviewed = app !== 'dashboard' && app !== 'admin';

useValidation(props.validator, async () => {
    if (markReviewed) {
        // Force saving: update date + make sure it is not null
        requiresFinancialSupport.value = requiresFinancialSupport.value as any
        await nextTick()
    }

    // Sync checkbox across family
    for (const member of props.member.family.members) {
        if (member.id !== props.member.member.id) {
            const expectedValue = member.isPropertyEnabled("financialSupport") ? (props.member.patchedMember.details.requiresFinancialSupport ?? null) : null;

            if (expectedValue?.value ?? null !== member.patchedMember.details.requiresFinancialSupport?.value ?? null) {
                member.addDetailsPatch({
                    requiresFinancialSupport: expectedValue
                })
            }
        }
    }

    return true;
});

const requiresFinancialSupport = computed({
    get: () => props.member.patchedMember.details.requiresFinancialSupport?.value ?? false,
    set: (requiresFinancialSupport) => {
        if (requiresFinancialSupport === (props.member.member.details.requiresFinancialSupport?.value ?? false) && !markReviewed) {
            return props.member.addDetailsPatch({
                requiresFinancialSupport: props.member.member.details.requiresFinancialSupport ?? null
            })
        }
        return props.member.addDetailsPatch({
            requiresFinancialSupport: BooleanStatus.create({
                value: requiresFinancialSupport
            })
        })
    }
});
const dataPermissionsChangeDate = computed(() => props.member.patchedMember.details.requiresFinancialSupport?.date ?? null);

const configuration = computed(() => {
    return props.member.platform.config.recordsConfiguration.financialSupport ?? props.member.organizations.find(o => o.meta.recordsConfiguration.dataPermission)?.meta.recordsConfiguration.financialSupport ?? null
});
const title = computed(() => configuration.value?.title ?? FinancialSupportSettings.defaultTitle);
const description = computed(() => configuration.value?.description ?? FinancialSupportSettings.defaultDescription);
const checkboxLabel = computed(() => configuration.value?.checkboxLabel ?? FinancialSupportSettings.defaultCheckboxLabel);

</script>

<template>
    <div v-if="isAdmin" class="container">
        <Title v-bind="$attrs" :title="title" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="hasKansenTarief">
            <Checkbox :model-value="true" :disabled="true">
                {{ checkboxLabel }}
            </Checkbox>
            <p class="style-description-small">
                Dit lid heeft recht op het kansentarief van de UiTPAS.
            </p>
        </template>
        <Checkbox v-else v-model="requiresFinancialSupportCheckboxValue">
            {{ checkboxLabel }}
        </Checkbox>

        <p v-if="!willMarkReviewed && dataPermissionsChangeDate" class="style-description-small">
            Laatst nagekeken op {{ formatDate(dataPermissionsChangeDate) }}. <button type="button" class="inline-link" @click="clear" v-tooltip="'Het lid zal deze stap terug moeten doorlopen via het ledenportaal'">Wissen</button>.
        </p>
    </div>
    <div v-else class="container">
        <Title v-bind="$attrs" :title="title" />
        <p class="style-description pre-wrap" v-text="description" />
            
        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="hasKansenTarief">
            <Checkbox :model-value="true" :disabled="true">
                {{ checkboxLabel }}
            </Checkbox>
            <p class="style-description-small">
                Je hebt recht op het kansentarief van de UiTPAS.
            </p>
        </template>
        <Checkbox v-else v-model="requiresFinancialSupportCheckboxValue" :disabled="hasKansenTarief">
            {{ checkboxLabel }}
        </Checkbox>
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { BooleanStatus, FinancialSupportSettings, PlatformMember } from '@stamhoofd/structures';
import { DataValidator } from '@stamhoofd/utility';
import { computed, nextTick, ref, watch } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import Title from './Title.vue';
import { useFinancialSupportSettings } from '../../../groups';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null,
    willMarkReviewed?: boolean
}>();

const errors = useErrors({validator: props.validator});
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';

useValidation(props.validator, async () => {
    // Save
    tryCreateRequiresFinancialSupportPatch(requiresFinancialSupportCheckboxValue.value);
    await nextTick()

    // Sync checkbox across family
    for (const member of props.member.family.members) {
        if (member.id !== props.member.patchedMember.id) {
            const expectedValue = member.isPropertyEnabled("financialSupport") ? (props.member.patchedMember.details.requiresFinancialSupport ?? null) : null;

            if (expectedValue !== null && expectedValue.value !== (member.patchedMember.details.requiresFinancialSupport?.value ?? null)) {
                member.addDetailsPatch({
                    requiresFinancialSupport: expectedValue
                })
            }
        }
    }

    return true;
});

function tryCreateRequiresFinancialSupportPatch(requiresFinancialSupport: boolean) {
    function getPreventSelfAssignment(financialSupportSettings: FinancialSupportSettings): boolean {
        return financialSupportSettings.preventSelfAssignment;
    }

    if(!isAdmin) {
        if(requiresFinancialSupport && getPreventSelfAssignment(financialSupportSettings.value)) {
            throw new SimpleError({
                code: 'financial_support_prevent_assignment',
                message: 'Self assignment of financial support is not allowed',
                human: financialSupportSettings.value.preventSelfAssignmentText ?? FinancialSupportSettings.defaultPreventSelfAssignmentText
            });
        }
    }

    if (requiresFinancialSupport === (props.member.member.details.requiresFinancialSupport?.value ?? false) && !props.willMarkReviewed) {
        // Do not patch: hasn't changed
        return;
    }
    
    return props.member.addDetailsPatch({
        requiresFinancialSupport: BooleanStatus.create({
            value: requiresFinancialSupport
        })
    })
}

const requiresFinancialSupportCheckboxValue = ref(props.member.patchedMember.details.requiresFinancialSupport?.value ?? false);
const requiresFinancialSupport = computed(() => props.member.patchedMember.details.requiresFinancialSupport?.value ?? false);

watch(requiresFinancialSupport, (requiresFinancialSupport) => {
    requiresFinancialSupportCheckboxValue.value = requiresFinancialSupport;
});

const hasKansenTarief = computed(() => {
    const uitpasNumber = props.member.patchedMember.details.uitpasNumber;
    if(uitpasNumber === null) return false;
    return DataValidator.isUitpasNumberKansenTarief(uitpasNumber)
});

const dataPermissionsChangeDate = computed(() => props.member.patchedMember.details.requiresFinancialSupport?.date ?? null);

const {financialSupportSettings} = useFinancialSupportSettings()

const title = computed(() => financialSupportSettings.value.title);
const description = computed(() => financialSupportSettings.value.description);
const checkboxLabel = computed(() => financialSupportSettings.value.checkboxLabel);

function clear() {
    props.member.addDetailsPatch({
        requiresFinancialSupport: null
    })
}

</script>

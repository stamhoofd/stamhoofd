<template>
    <div class="container">
        <Title v-bind="$attrs" :title="isAdmin ? 'UiTPAS-nummer' : 'UiTPAS'" />
        <p v-if="!isAdmin" class="style-description pre-wrap" v-text="'Heb je een UiTPAS? Vul dan hier het nummer in.'" />
            
        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <UitpasNumberInput
            v-model="uitpasNumber"
            :required="isPropertyRequired('uitpasNumber')"
            :validator="validator"
            :title="isAdmin ? undefined : 'UiTPAS-nummer'"
        />
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import UitpasNumberInput from '../../../inputs/UitpasNumberInput.vue';
import { useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null
}>();

const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const errors = useErrors({validator: props.validator});
const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));

const uitpasNumber = computed({
    get: () => props.member.patchedMember.details.uitpasNumber,
    set: (uitpasNumber) => {
        props.member.addDetailsPatch({uitpasNumber});
    }
});
</script>

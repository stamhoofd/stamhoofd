<template>
    <div class="container">
        <Title v-bind="$attrs" :title="isAdmin ? $t(`d70f2a7f-d8b4-4846-8dc0-a8e978765b9d`) : $t(`612b0f89-4a6e-4616-a50f-6e228daa86c3`)" />
        <p v-if="!isAdmin" class="style-description pre-wrap" v-text="$t('45ec384e-f7c5-4a4f-bb70-396f800f1929')" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <UitpasNumberInputWithStatus v-model="uitpasNumberDetails" :required="isPropertyRequired('uitpasNumber')" :validator="validator" :title="isAdmin ? undefined : $t(`d70f2a7f-d8b4-4846-8dc0-a8e978765b9d`)" error-fields="uitpasNumber" />

        <p v-if="!willMarkReviewed && isAdmin && reviewDate" class="style-description-small">
            {{ $t('ef93c19a-9c97-4598-a11a-95d7a2bf2f02') }} {{ formatDate(reviewDate) }}. <button :v-tooltip="$t('1452c1a3-6203-4ab2-92c4-c0496661cd21')" type="button" class="inline-link" @click="clear">
                {{ $t('74366859-3259-4393-865e-9baa8934327a') }}
            </button>.
        </p>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import UitpasNumberInputWithStatus from '../../../inputs/UitpasNumberInputWithStatus.vue';
import { useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
    willMarkReviewed?: boolean;
}>();

const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const errors = useErrors({ validator: props.validator });
const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));

const uitpasNumberDetails = computed({
    get: () => props.member.patchedMember.details.uitpasNumberDetails,
    set: (details) => {
        props.member.addDetailsPatch({ uitpasNumberDetails: details });
    },
});

const reviewDate = computed(() => {
    return props.member.patchedMember.details.reviewTimes.getLastReview('uitpasNumber');
});

function clear() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.removeReview('uitpasNumber');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}

</script>

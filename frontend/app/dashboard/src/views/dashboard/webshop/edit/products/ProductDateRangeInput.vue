<template>
    <div>
        <Checkbox v-model="multipleDays">
            {{ $t('%7S') }}
        </Checkbox>

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="multipleDays ? $t(`%1Of`) : $t(`%7R`)">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-if="multipleDays" v-model="startDate" :validator="errors.validator" :title="$t(`%U4`)" />
        </div>
        <div class="split-inputs">
            <STInputBox v-if="multipleDays" error-fields="endDate" :error-box="errors.errorBox" :title="$t(`%1P8`)">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-else v-model="startDate" :validator="errors.validator" :title="$t(`%U4`)" />
            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t(`%5L`)" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { SimpleError } from '@common/errors';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import TimeInput from '@stamhoofd/components/inputs/TimeInput.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useValidation } from '@stamhoofd/components/errors/useValidation.ts';
import type { Validator } from '@stamhoofd/components/errors/Validator.ts';
import type { ProductDateRange } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{ validator?: Validator | null }>(), {
    // Assign a validator if you want to offload the validation to components
    validator: null,
});

const errors = useErrors({
    validator: props.validator });

const model = defineModel<ProductDateRange | null>({ default: null });

if (props.validator) {
    useValidation(props.validator, async () => {
        return await isValid();
    });
}

/**
 * Without multiple days, only one date is entered. An end time before 7:00 that is earlier than the start time
 * runs past midnight, so it ends the next day (e.g. from 21:00 until 2:00).
 */
function getSingleDayEndDate(startDate: Date, endDate: Date): Date {
    const start = Formatter.luxon(startDate);
    let end = Formatter.luxon(endDate).set({ year: start.year, month: start.month, day: start.day });

    if (end.hour < 7 && end < start) {
        end = end.plus({ days: 1 });
    }
    return end.toJSDate();
}

function isSingleDay(range: ProductDateRange) {
    return getSingleDayEndDate(range.startDate, range.endDate).getTime() === range.endDate.getTime();
}

const multipleDaysCache = ref(model.value ? !isSingleDay(model.value) : false);

const multipleDays = computed({
    get: () => multipleDaysCache.value,
    set: (multipleDays: boolean) => {
        multipleDaysCache.value = multipleDays;

        if (!model.value) {
            return;
        }

        if (!multipleDays) {
            model.value = model.value.patch({ endDate: getSingleDayEndDate(model.value.startDate, model.value.endDate) });
            return;
        }

        if (Formatter.luxon(model.value.startDate).hasSame(Formatter.luxon(model.value.endDate), 'day')) {
            model.value = model.value.patch({ endDate: Formatter.luxon(model.value.endDate).plus({ days: 1 }).toJSDate() });
        }
    },
});

const startDate = computed({
    get: () => model.value?.startDate ?? new Date(),
    set: (startDate: Date) => {
        if (model.value) {
            model.value = model.value.patch({
                startDate,
                endDate: multipleDays.value ? model.value.endDate : getSingleDayEndDate(startDate, model.value.endDate),
            });
        }
    },
});

const endDate = computed({
    get: () => model.value?.endDate ?? new Date(),
    set: (endDate: Date) => {
        if (model.value) {
            model.value = model.value.patch({
                endDate: multipleDays.value ? endDate : getSingleDayEndDate(model.value.startDate, endDate),
            });
        }
    },
});

async function isValid(): Promise<boolean> {
    await Promise.resolve();
    if (startDate.value > endDate.value) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            field: 'endDate',
            message: 'De einddatum en tijdstip die je hebt ingevuld ligt voor de startdatum en tijdstip',
        }));
        return false;
    }

    return true;
}
</script>

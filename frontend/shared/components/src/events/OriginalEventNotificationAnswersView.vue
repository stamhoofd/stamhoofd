<template>
    <div class="st-view">
        <STNavigationBar :title="$t('Originele antwoorden')" />

        <main>
            <h1>
                {{ $t('Originele antwoorden') }}
            </h1>
            <p>{{ $t('Hieronder zie je de antwoorden op alle vragen op het moment van de laatste (voorlopige) goedkeuring') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="notification" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '../errors/useErrors';
import { EventNotificationViewModel } from './event-notifications/classes/EventNotificationViewModel';

const props = withDefaults(
    defineProps<{
        viewModel: EventNotificationViewModel;
    }>(), {

    },
);

const notification = props.viewModel.useOriginalNotification();
const errors = useErrors(); ;
const type = props.viewModel.useType();

const recordCategories = computed(() => {
    return RecordCategory.filterCategories(type.value.recordCategories, notification.value);
});

</script>

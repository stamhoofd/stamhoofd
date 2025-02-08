<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>
            <p>{{ type.description }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList class="info">
                <STListItem :selectable="true">
                    <h3 class="style-definition-label">
                        Activiteiten
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ notification.events.map(e => e.name).join(', ') }}</span>
                    </p>
                    <p class="style-description-small">
                        Je kan een melding koppelen aan één of meerdere activiteiten uit jullie kalender van Stamhoofd op voorwaarde dat ze plaatsvinden op dezelfde locatie en tijdstip.
                    </p>

                    <template #right>
                        <span class="icon edit gray" />
                    </template>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Datum
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(formatDateRange(notification.startDate, notification.endDate)) }}</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Status
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ notification.status }}</span>
                        <span class="icon clock" />
                    </p>

                    <p v-if="notification.submittedBy" class="style-description-small">
                        Ingediend door {{ notification.submittedBy.name }}
                    </p>
                </STListItem>

                <STListItem v-if="notification.feedbackText">
                    <h3 class="style-definition-label">
                        Opmerkingen
                    </h3>
                    <p class="style-definition-text">
                        {{ notification.feedbackText }}
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>Gegevens</h2>
            <p>Vul de gegevens hieronder aan voor je de kampmelding indient.</p>

            <!-- For each record category: a new view -->
            <STList>
                <STListItem v-for="category of type.recordCategories" :key="category.id" :selectable="true" @click="editRecordCategory(category)">
                    <h3 class="style-title-list">
                        {{ category.name }}
                    </h3>
                    <p class="style-description">
                        Nog niet ingevuld
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="() => pop()">
                    Sluiten
                </button>

                <LoadingButton :loading="loading">
                    <button class="button primary" :disabled="true" type="submit">
                        <span class="icon success" />
                        <span>Indienen</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useErrors } from '../errors/useErrors';
import { EventNotificationViewModel } from './event-notifications/classes/EventNotificationViewModel';
import EditEventNotificationRecordCategoryView from './event-notifications/EditEventNotificationRecordCategoryView.vue';

const props = withDefaults(
    defineProps<{
        viewModel: EventNotificationViewModel;
    }>(), {

    },
);

const notification = props.viewModel.useNotification();
const errors = useErrors(); ;
const loading = ref(false);
const pop = usePop();
const type = props.viewModel.useType();
const present = usePresent();

const title = computed(() => {
    return type.value.title;
});

async function editRecordCategory(recordCategory: RecordCategory) {
    await present({
        components: [
            new ComponentWithProperties(EditEventNotificationRecordCategoryView, {
                viewModel: props.viewModel,
                category: recordCategory,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

</script>

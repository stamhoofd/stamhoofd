<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        :estimated-rows="estimatedRows"
        :Route="Route"
        :default-filter="defaultFilter"
    >
        <template #empty>
            {{ $t('4fa242b7-c05d-44d4-ada5-fb60e91af818') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { Column, ComponentExposed, ModernTableView, TableAction, useEmailRecipientsFilterBuilders, useTableObjectFetcher } from '@stamhoofd/components';
import { EmailPreview, EmailRecipient, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
import { useEmailRecipientsObjectFetcher } from '../fetchers/useEmailRecipientsObjectFetcher';
import EmailRecipientView from './EmailRecipientView.vue';

type ObjectType = EmailRecipient;

const props = withDefaults(
    defineProps<{
        email?: EmailPreview | null;
    }>(),
    {
        email: null,
    },
);

const title = computed(() => {
    if (props.email) {
        return $t('Ontvangers van ‘{emailSubject}’', { emailSubject: props.email.replacedSubject });
    }
    return $t('Alle ontvangers');
});

const estimatedRows = computed(() => {
    if (props.email) {
        return props.email.emailRecipientsCount ?? 0;
    }
    return 30;
});
const getFilterBuilders = useEmailRecipientsFilterBuilders();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'event-notifications';
});
const filterBuilders = computed(() => getFilterBuilders());

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.email) {
        return {
            emailId: props.email.id,
            email: {
                $neq: null,
            },
        };
    }

    return {
        email: {
            $neq: null,
        },
    };
}

const defaultFilter = null;

const objectFetcher = useEmailRecipientsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string | null>({
        id: 'email',
        name: $t('E-mailadres'),
        getValue: e => e.email || '',
        minimumWidth: 200,
        recommendedWidth: 300,
        index: 0,
    }),

    new Column<ObjectType, string | null>({
        id: 'name',
        name: $t('Naam'),
        getValue: e => e.name || '',
        minimumWidth: 150,
        recommendedWidth: 200,
        index: 1,
    }),

    new Column<ObjectType, EmailRecipient>({
        id: 'sentAt',
        name: $t('Status'),
        getValue: e => e,
        format: (email) => {
            if (email.sentAt) {
                return $t('Verzonden om {time}', { time: Formatter.time(email.sentAt) });
            }

            if (email.failError) {
                if (email.failError.hasCode('email_skipped_hard_bounce')) {
                    return $t('Eerdere hard bounce');
                }
                if (email.failError.hasCode('email_skipped_spam')) {
                    return $t('Eerdere spammelding');
                }
                if (email.failError.hasCode('email_skipped_unsubscribed')) {
                    return $t('Afgemeld voor deze e-mails');
                }
                return email.failError.human;
            }

            return $t('In wachtrij');
        },
        getStyle: (email) => {
            if (email.sentAt) {
                return 'success';
            }

            if (email.failError) {
                return 'error';
            }

            return 'gray';
        },
        minimumWidth: 100,
        recommendedWidth: 200,
        index: 2,
    }),
];

const Route = {
    Component: EmailRecipientView,
    objectKey: 'recipient',
};

const actions: TableAction<ObjectType>[] = [];
</script>

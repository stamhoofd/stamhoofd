<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :estimated-rows="estimatedRows"
        :Route="Route"
        :default-filter="defaultFilter"
    >
        <p v-if="props.filterType === 'complaints'" class="style-description-block">
            <I18nComponent :t="$t('%1FB')">
                <template #button="{content}">
                    <a class="inline-link" :href="$domains.getDocs('spam-complaints')" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <p v-if="props.filterType === 'hard-bounces'" class="style-description-block">
            <I18nComponent :t="$t('%1FC')">
                <template #button="{content}">
                    <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <p v-if="props.filterType === 'soft-bounces'" class="style-description-block">
            <I18nComponent :t="$t('%1FD')">
                <template #button="{content}">
                    <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <template #empty>
            {{ $t('%39') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { Column } from '#tables/classes/Column.ts';
import type { ComponentExposed } from '#VueGlobalHelper.ts';
import ModernTableView from '#tables/ModernTableView.vue';
import { TableAction } from '#tables/classes/TableAction.ts';
import { useEmailRecipientsFilterBuilders } from '#filters/filterBuilders.ts';
import { useTableObjectFetcher } from '#tables/classes/TableObjectFetcher.ts';
import { EmailPreview, EmailRecipient, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
import { useEmailRecipientsObjectFetcher } from '../fetchers/useEmailRecipientsObjectFetcher';
import EmailRecipientView from './EmailRecipientView.vue';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { isSoftEmailRecipientError } from '@stamhoofd/structures';

type ObjectType = EmailRecipient;

const props = withDefaults(
    defineProps<{
        filterType?: null | 'complaints' | 'hard-bounces' | 'soft-bounces' | 'failed';
        email?: EmailPreview | null;
        filter?: StamhoofdFilter | null;
    }>(),
    {
        email: null,
        filter: null,
        filterType: null,
    },
);

const title = computed(() => {
    if (props.filterType === 'complaints') {
        return $t('%1FE');
    }
    if (props.filterType === 'hard-bounces') {
        return $t('%1FF');
    }
    if (props.filterType === 'soft-bounces') {
        return $t('%1FG');
    }
    if (props.filterType === 'failed') {
        return $t('%1FH');
    }

    if (props.email) {
        return $t('%1FI', { emailSubject: props.email.replacedSubject });
    }
    return $t('%1FJ');
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
    return 'email-recipients';
});
const filterBuilders = computed(() => getFilterBuilders());

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.email) {
        return {
            emailId: props.email.id,
            duplicateOfRecipientId: null,
            email: {
                $neq: null,
            },
        };
    }

    return {
        duplicateOfRecipientId: null,
        email: {
            $neq: null,
        },
    };
}

const defaultFilter = props.filter; ;

const objectFetcher = useEmailRecipientsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string | null>({
        id: 'email',
        name: $t('%1FK'),
        getValue: e => e.email || '',
        minimumWidth: 200,
        recommendedWidth: 300,
        index: 0,
    }),

    new Column<ObjectType, string | null>({
        id: 'name',
        name: $t('%Gq'),
        getValue: e => e.name || '',
        minimumWidth: 150,
        recommendedWidth: 200,
        index: 1,
    }),

    new Column<ObjectType, EmailRecipient>({
        id: 'sentAt',
        name: $t('%1FL'),
        getValue: e => e,
        format: (email) => {
            if (email.sentAt) {
                return $t('%1FM', { time: Formatter.time(email.sentAt) });
            }

            if (email.failError) {
                if (email.failError.hasCode('email_skipped_hard_bounce')) {
                    return $t('%1FN');
                }
                if (email.failError.hasCode('email_skipped_spam')) {
                    return $t('%1FO');
                }
                if (email.failError.hasCode('email_skipped_unsubscribed')) {
                    return $t('%1FP');
                }
                return email.failError.human;
            }

            return $t('%1FQ');
        },
        getStyle: (email) => {
            if (email.sentAt) {
                return 'success';
            }

            if (email.failError && isSoftEmailRecipientError(email.failError)) {
                return 'warn';
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

    new Column<ObjectType, EmailRecipient>({
        id: 'notifications',
        name: $t('%1FR'),
        description: $t('%1FS'),
        getValue: e => e,
        format: (email) => {
            if (email.spamComplaintError) {
                return $t('%1FT');
            }

            if (email.hardBounceError) {
                return $t('%1FU');
            }

            if (email.softBounceError) {
                return $t('%1FV');
            }

            return $t('%1FW');
        },
        getStyle: (email) => {
            if (email.spamComplaintError || email.hardBounceError) {
                return 'error';
            }

            if (email.softBounceError) {
                return 'warning';
            }

            return 'success';
        },
        minimumWidth: 100,
        recommendedWidth: 200,
        index: 3,
        allowSorting: false,
    }),
];

const Route = {
    Component: EmailRecipientView,
    objectKey: 'recipient',
    getProperties: (object: ObjectType) => {
        return {
            email: props.email ?? undefined,
            recipient: object,
        };
    },
};

const actions: TableAction<ObjectType>[] = [];
</script>

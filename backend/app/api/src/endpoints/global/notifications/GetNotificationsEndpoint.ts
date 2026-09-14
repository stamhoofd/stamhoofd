import type { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import { SQL, SQLSelect, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import type { CountFilteredRequest } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PaginatedResponse, SortItemDirection } from '@stamhoofd/structures';
import type { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';

import { Context } from '../../../helpers/Context.js';
import { LimitedFilteredRequestHelper } from '../../../helpers/LimitedFilteredRequestHelper.js';
import { notificationFilterCompilers, notificationJoin } from '../../../sql-filters/notifications.js';
import { notificationSorters } from '../../../sql-sorters/notifications.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<UserNotification[], LimitedFilteredRequest>;

type RecipientWithNotification = NotificationRecipient & { notification: Notification };

/**
 * Notifications of the authenticated user, newest first.
 */
export class GetNotificationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/notifications', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static selectRecipientsWithNotification(): SQLSelect<RecipientWithNotification> {
        const transformer = (row: SQLResultNamespacedRow): RecipientWithNotification => {
            const recipient = NotificationRecipient.fromRow(row[NotificationRecipient.table]);
            const notification = Notification.fromRow(row[Notification.table]);

            if (!recipient || !notification) {
                console.error('Could not transform row', row, 'into notification models, check if the primary keys are returned in the query');
                throw new Error('Missing data for notification');
            }

            return Object.assign(recipient, { notification });
        };

        return new SQLSelect(transformer, SQL.wildcard(NotificationRecipient.table), SQL.wildcard(Notification.table))
            .from(SQL.table(NotificationRecipient.table))
            .join(notificationJoin);
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const query = this.selectRecipientsWithNotification()
            .where(SQL.column(NotificationRecipient.table, 'userId'), Context.impersonatedUserOrUser.id);

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, notificationFilterCompilers));
        }

        if (q.search) {
            throw new SimpleError({
                code: 'not_supported',
                message: 'Search is not possible in notifications',
                human: $t('%Zqm'),
            });
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(await compileToSQLFilter(q.pageFilter, notificationFilterCompilers));
            }

            q.sort = this.assertSort(q.sort);
            applySQLSorter(query, q.sort, notificationSorters);
            query.limit(q.limit);
        }

        return query;
    }

    /**
     * Only the (indexed) newest-first order is supported
     */
    private static assertSort(sort: LimitedFilteredRequest['sort']): LimitedFilteredRequest['sort'] {
        const allowed = [{ key: 'id', order: SortItemDirection.DESC }];

        if (sort.length === 0) {
            return allowed;
        }

        if (sort.length === 1 && sort[0].key === 'id' && sort[0].order === SortItemDirection.DESC) {
            return allowed;
        }

        throw new SimpleError({
            code: 'invalid_field',
            field: 'sort',
            message: 'Notifications can only be sorted by id DESC',
        });
    }

    static async buildData(requestQuery: LimitedFilteredRequest): Promise<ResponseBody> {
        const query = await this.buildQuery(requestQuery);
        const results = await query.fetch();

        const next = LimitedFilteredRequestHelper.fixInfiniteLoadingLoop({
            request: requestQuery,
            results,
            sorters: notificationSorters,
        });

        return new PaginatedResponse<UserNotification[], LimitedFilteredRequest>({
            results: results.map(r => r.getStructure(r.notification)),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        await Context.authenticate();

        LimitedFilteredRequestHelper.throwIfInvalidLimit({ request: request.query, maxLimit: 100 });

        return new Response(
            await GetNotificationsEndpoint.buildData(request.query),
        );
    }
}

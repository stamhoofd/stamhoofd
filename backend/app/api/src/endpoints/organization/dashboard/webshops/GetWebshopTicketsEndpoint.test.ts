import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Ticket, User, Webshop } from '@stamhoofd/models';
import { GroupFactory, OrderFactory, OrganizationFactory, TicketFactory, UserFactory, WebshopFactory } from '@stamhoofd/models';
import type { CountResponse, PaginatedResponse, StamhoofdFilter, TicketPrivate } from '@stamhoofd/structures';
import { AccessRight, CountFilteredRequest, LimitedFilteredRequest, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, SortItemDirection } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { GetWebshopTicketsCountEndpoint } from './GetWebshopTicketsCountEndpoint.js';
import { GetWebshopTicketsEndpoint } from './GetWebshopTicketsEndpoint.js';

describe('Endpoint.GetWebshopTicketsEndpoint', () => {
    const endpoint = new GetWebshopTicketsEndpoint();
    const countEndpoint = new GetWebshopTicketsCountEndpoint();

    /**
     * Same sort as the offline download of the ticket scanner
     */
    const syncSort = [
        { key: 'updatedAt', order: SortItemDirection.ASC },
        { key: 'id', order: SortItemDirection.ASC },
    ];

    const getTickets = async ({ query, organization, user }: { query: LimitedFilteredRequest; organization: Organization; user: User }) => {
        const token = await SessionService.createSession(user);

        const request = Request.get({
            path: '/webshop/tickets/private',
            host: organization.getApiHost(),
            query,
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<PaginatedResponse<TicketPrivate[], LimitedFilteredRequest>>(endpoint, request);
    };

    const filterTickets = async ({ filter, organization, user }: { filter: StamhoofdFilter; organization: Organization; user: User }) => {
        return getTickets({ query: new LimitedFilteredRequest({ filter, limit: 100 }), organization, user });
    };

    /**
     * Follows the next pages like the offline download does
     */
    const getAllPages = async ({ filter, limit, organization, user }: { filter: StamhoofdFilter; limit: number; organization: Organization; user: User }) => {
        const tickets: TicketPrivate[] = [];
        let next: LimitedFilteredRequest | undefined = new LimitedFilteredRequest({ filter, limit, sort: syncSort });

        while (next) {
            const response = await getTickets({ query: next, organization, user });
            expect(response.status).toBe(200);
            tickets.push(...response.body.results);
            next = response.body.next;
        }
        return tickets;
    };

    const countTickets = async ({ filter, organization, user }: { filter: StamhoofdFilter; organization: Organization; user: User }) => {
        const token = await SessionService.createSession(user);

        const request = Request.get({
            path: '/webshop/tickets/private/count',
            host: organization.getApiHost(),
            query: new CountFilteredRequest({ filter }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<CountResponse>(countEndpoint, request);
    };

    const createWebshopAdmin = async ({ organization, webshop, level, accessRights = [] }: { organization: Organization; webshop: Webshop; level: PermissionLevel; accessRights?: AccessRight[] }) => {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([
                    [PermissionsResourceType.Webshops, new Map([[webshop.id, ResourcePermissions.create({
                        resourceName: webshop.meta.name,
                        level,
                        accessRights,
                    })]])],
                ]),
            }),
        }).create();
    };

    let organization: Organization;
    let user: User;
    let webshop: Webshop;

    beforeEach(async () => {
        organization = await new OrganizationFactory({}).create();
        user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        webshop = await new WebshopFactory({ organizationId: organization.id }).create();
    });

    test('filters tickets on their secret', async () => {
        const order = await new OrderFactory({ webshop }).create();

        const ticket = await new TicketFactory({ order, index: 1, total: 2 }).create();
        await new TicketFactory({ order, index: 2, total: 2 }).create();

        const response = await filterTickets({
            organization,
            user,
            filter: { webshopId: webshop.id, secret: ticket.secret },
        });

        expect(response.status).toBe(200);
        expect(response.body.results).toEqual([
            expect.objectContaining({ id: ticket.id, secret: ticket.secret }),
        ]);
    });

    test('pages through tickets updated in the same second without skipping or repeating tickets', async () => {
        const order = await new OrderFactory({ webshop }).create();
        const updatedAt = new Date(Date.now() - 60 * 60 * 1000);
        const tickets: Ticket[] = [];
        for (let i = 0; i < 7; i++) {
            tickets.push(await new TicketFactory({ order, index: i + 1, total: 7, updatedAt }).create());
        }
        // Another second, so the pages also cross a change of updatedAt
        tickets.push(await new TicketFactory({ order, index: 8, total: 8, updatedAt: new Date(updatedAt.getTime() + 1_000) }).create());

        const fetched = await getAllPages({ organization, user, filter: { webshopId: webshop.id }, limit: 3 });

        expect(fetched.map(t => t.id)).toEqual([
            ...tickets.slice(0, 7).map(t => t.id).sort(),
            tickets[7].id,
        ]);
    });

    test('only returns tickets updated after the cursor of the download', async () => {
        const order = await new OrderFactory({ webshop }).create();
        const cursor = new Date(Date.now() - 60 * 60 * 1000);
        await new TicketFactory({ order, index: 1, total: 3, updatedAt: new Date(cursor.getTime() - 1_000) }).create();
        await new TicketFactory({ order, index: 2, total: 3, updatedAt: cursor }).create();
        const updated = await new TicketFactory({ order, index: 3, total: 3, updatedAt: new Date(cursor.getTime() + 1_000) }).create();

        const filter = { webshopId: webshop.id, updatedAt: { $gt: cursor } };
        const fetched = await getAllPages({ organization, user, filter, limit: 100 });

        expect(fetched.map(t => t.id)).toEqual([updated.id]);

        const count = await countTickets({ organization, user, filter });
        expect(count.body.count).toBe(1);
    });

    test('returns deleted tickets, so devices remove them from their offline database', async () => {
        const order = await new OrderFactory({ webshop }).create();
        const ticket = await new TicketFactory({ order }).create();
        await ticket.softDelete();

        const response = await filterTickets({ organization, user, filter: { webshopId: webshop.id } });

        expect(response.body.results).toEqual([
            expect.objectContaining({ id: ticket.id, deletedAt: expect.any(Date) }),
        ]);
    });

    test('does not return tickets of other organizations', async () => {
        const otherOrganization = await new OrganizationFactory({}).create();
        const otherWebshop = await new WebshopFactory({ organizationId: otherOrganization.id }).create();
        await new TicketFactory({ order: await new OrderFactory({ webshop: otherWebshop }).create() }).create();

        const response = await filterTickets({ organization, user, filter: { webshopId: otherWebshop.id } });

        expect(response.body.results).toEqual([]);
    });

    test('a user who can only scan tickets can download them', async () => {
        const ticket = await new TicketFactory({ order: await new OrderFactory({ webshop }).create() }).create();
        const scanner = await createWebshopAdmin({ organization, webshop, level: PermissionLevel.None, accessRights: [AccessRight.WebshopScanTickets] });

        const response = await filterTickets({ organization, user: scanner, filter: { webshopId: webshop.id } });

        expect(response.body.results).toEqual([expect.objectContaining({ id: ticket.id })]);
    });

    test('a user who can only scan tickets can look up and count a ticket by its secret', async () => {
        const order = await new OrderFactory({ webshop }).create();
        const ticket = await new TicketFactory({ order, index: 1, total: 3 }).create();
        const other = await new TicketFactory({ order, index: 2, total: 3 }).create();
        await new TicketFactory({ order, index: 3, total: 3 }).create();
        const scanner = await createWebshopAdmin({ organization, webshop, level: PermissionLevel.None, accessRights: [AccessRight.WebshopScanTickets] });

        const response = await filterTickets({ organization, user: scanner, filter: { webshopId: webshop.id, secret: ticket.secret } });
        expect(response.body.results).toEqual([expect.objectContaining({ id: ticket.id })]);

        const count = await countTickets({ organization, user: scanner, filter: { webshopId: webshop.id, secret: { $in: [ticket.secret, other.secret] } } });
        expect(count.body.count).toBe(2);
    });

    test('a user without access to the webshop cannot download or count its tickets', async () => {
        const ticket = await new TicketFactory({ order: await new OrderFactory({ webshop }).create() }).create();
        const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const ownTicket = await new TicketFactory({ order: await new OrderFactory({ webshop: otherWebshop }).create() }).create();
        const otherAdmin = await createWebshopAdmin({ organization, webshop: otherWebshop, level: PermissionLevel.Full });

        // Responses must not depend on whether the filter matches tickets of the inaccessible webshop
        const filters: StamhoofdFilter[] = [
            { webshopId: webshop.id },
            { webshopId: webshop.id, secret: ticket.secret },
            { secret: ticket.secret },
            { id: ticket.id },
        ];
        for (const filter of filters) {
            const response = await filterTickets({ organization, user: otherAdmin, filter });
            expect(response.body.results).toEqual([]);

            const count = await countTickets({ organization, user: otherAdmin, filter });
            expect(count.body.count).toBe(0);
        }

        const response = await filterTickets({ organization, user: otherAdmin, filter: { $or: [{ webshopId: otherWebshop.id }, { secret: ticket.secret }] } });
        expect(response.body.results).toEqual([expect.objectContaining({ id: ownTicket.id })]);

        const count = await countTickets({ organization, user: otherAdmin, filter: {} });
        expect(count.body.count).toBe(1);
    });

    test('an admin without any webshop permissions cannot count tickets', async () => {
        const ticket = await new TicketFactory({ order: await new OrderFactory({ webshop }).create() }).create();
        const group = await new GroupFactory({ organization }).create();
        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([
                    [PermissionsResourceType.Groups, new Map([[group.id, ResourcePermissions.create({ level: PermissionLevel.Full })]])],
                ]),
            }),
        }).create();

        const count = await countTickets({ organization, user: admin, filter: { secret: ticket.secret } });
        expect(count.body.count).toBe(0);
    });

    test.each<StamhoofdFilter>([
        { $gt: '' },
        { $lt: 'zzzzzzzzzzzzzzzz' },
        { $gte: '' },
        { $contains: '' },
        { $neq: 'x' },
        { $not: { $eq: 'x' } },
    ])('rejects secret filter %j that could be used to guess secrets', async (secretFilter) => {
        await new TicketFactory({ order: await new OrderFactory({ webshop }).create() }).create();

        await expect(filterTickets({ organization, user, filter: { webshopId: webshop.id, secret: secretFilter } }))
            .rejects.toThrow(STExpect.errorWithCode('unknown_filter'));
        await expect(countTickets({ organization, user, filter: { webshopId: webshop.id, secret: secretFilter } }))
            .rejects.toThrow(STExpect.errorWithCode('unknown_filter'));
    });
});

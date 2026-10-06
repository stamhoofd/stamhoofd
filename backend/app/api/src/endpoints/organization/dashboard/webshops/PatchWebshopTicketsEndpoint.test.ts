import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User, Webshop } from '@stamhoofd/models';
import { OrderFactory, OrganizationFactory, Ticket, TicketFactory, UserFactory, WebshopFactory } from '@stamhoofd/models';
import { AccessRight, CartReservedSeat, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, TicketPrivate } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { PatchWebshopTicketsEndpoint } from './PatchWebshopTicketsEndpoint.js';

describe('Endpoint.PatchWebshopTicketsEndpoint', () => {
    const endpoint = new PatchWebshopTicketsEndpoint();

    const patchTickets = async ({ patches, webshop, user }: { patches: AutoEncoderPatchType<TicketPrivate>[]; webshop: Webshop; user: User }) => {
        const token = await SessionService.createSession(user);

        const request = Request.patch({
            path: `/webshop/${webshop.id}/tickets/private`,
            host: organization.getApiHost(),
            body: patches,
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<TicketPrivate[]>(endpoint, request);
    };

    /**
     * Same patch as the ticket scanner sends
     */
    const scanPatch = (ticket: Ticket, { scannedAt = new Date(), scannedBy = 'Scanner' }: { scannedAt?: Date; scannedBy?: string } = {}) => TicketPrivate.patch({
        id: ticket.id,
        secret: ticket.secret,
        scannedAt,
        scannedBy,
    });

    const createWebshopAdmin = async ({ level, accessRights = [] }: { level: PermissionLevel; accessRights?: AccessRight[] }) => {
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
    let ticket: Ticket;

    beforeEach(async () => {
        organization = await new OrganizationFactory({}).create();
        user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        ticket = await new TicketFactory({
            order: await new OrderFactory({ webshop }).create(),
            updatedAt: new Date(Date.now() - 60 * 60 * 1000),
        }).create();
    });

    test('scanning a ticket moves its updatedAt, so other devices download the scan', async () => {
        const scannedAt = new Date(Date.now() - 5 * 60 * 1000);
        scannedAt.setMilliseconds(0);

        const response = await patchTickets({ webshop, user, patches: [scanPatch(ticket, { scannedAt, scannedBy: 'Jan' })] });

        expect(response.body).toEqual([expect.objectContaining({ id: ticket.id, scannedAt, scannedBy: 'Jan' })]);

        const updated = await Ticket.getByID(ticket.id);
        expect(updated!.scannedAt).toEqual(scannedAt);
        expect(updated!.scannedBy).toBe('Jan');
        expect(updated!.updatedAt.getTime()).toBeGreaterThan(ticket.updatedAt.getTime());
    });

    test('clearing a scan moves its updatedAt', async () => {
        await patchTickets({ webshop, user, patches: [scanPatch(ticket)] });
        await Ticket.update().set('updatedAt', ticket.updatedAt).where('id', ticket.id).update();

        await patchTickets({ webshop, user, patches: [TicketPrivate.patch({ id: ticket.id, secret: ticket.secret, scannedAt: null, scannedBy: null })] });

        const updated = await Ticket.getByID(ticket.id);
        expect(updated!.scannedAt).toBeNull();
        expect(updated!.scannedBy).toBeNull();
        expect(updated!.updatedAt.getTime()).toBeGreaterThan(ticket.updatedAt.getTime());
    });

    test('only changes the scan of a ticket', async () => {
        const otherOrder = await new OrderFactory({ webshop }).create();

        await patchTickets({ webshop, user, patches: [TicketPrivate.patch({
            id: ticket.id,
            secret: 'changed-secret',
            orderId: otherOrder.id,
            itemId: 'other-item',
            index: 5,
            total: 5,
            deletedAt: new Date(),
            seat: CartReservedSeat.create({ section: 'A', row: '1', seat: '1' }),
            scannedAt: new Date(),
        })] });

        const updated = await Ticket.getByID(ticket.id);
        expect(updated).toMatchObject({
            secret: ticket.secret,
            orderId: ticket.orderId,
            itemId: ticket.itemId,
            index: ticket.index,
            total: ticket.total,
            deletedAt: null,
            seat: null,
        });
        expect(updated!.scannedAt).not.toBeNull();
    });

    test('the last device that saves its scan wins', async () => {
        const firstScan = new Date(Date.now() - 2 * 60 * 1000);
        firstScan.setMilliseconds(0);
        const secondScan = new Date(Date.now() - 60 * 1000);
        secondScan.setMilliseconds(0);

        await patchTickets({ webshop, user, patches: [scanPatch(ticket, { scannedAt: secondScan, scannedBy: 'Device B' })] });
        await patchTickets({ webshop, user, patches: [scanPatch(ticket, { scannedAt: firstScan, scannedBy: 'Device A' })] });

        const updated = await Ticket.getByID(ticket.id);
        expect(updated!.scannedAt).toEqual(firstScan);
        expect(updated!.scannedBy).toBe('Device A');
    });

    test('saving the same scan again changes nothing, so devices can safely retry', async () => {
        const scannedAt = new Date(Date.now() - 60 * 1000);
        scannedAt.setMilliseconds(0);

        await patchTickets({ webshop, user, patches: [scanPatch(ticket, { scannedAt })] });
        const response = await patchTickets({ webshop, user, patches: [scanPatch(ticket, { scannedAt })] });

        expect(response.body).toEqual([expect.objectContaining({ id: ticket.id, scannedAt })]);
    });

    test('rejects tickets of another webshop, but still saves the other scans of the request', async () => {
        const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const otherTicket = await new TicketFactory({ order: await new OrderFactory({ webshop: otherWebshop }).create() }).create();

        await expect(patchTickets({ webshop, user, patches: [scanPatch(otherTicket), scanPatch(ticket)] }))
            .rejects.toThrow(STExpect.simpleError({ code: 'ticket_not_found', field: otherTicket.id }));

        expect((await Ticket.getByID(otherTicket.id))!.scannedAt).toBeNull();
        expect((await Ticket.getByID(ticket.id))!.scannedAt).not.toBeNull();
    });

    test('rejects tickets that do not exist', async () => {
        const deleted = TicketPrivate.patch({ id: 'deleted-ticket-id', secret: 'deleted', scannedAt: new Date() });

        await expect(patchTickets({ webshop, user, patches: [deleted] }))
            .rejects.toThrow(STExpect.simpleError({ code: 'ticket_not_found', field: 'deleted-ticket-id' }));
    });

    test('a user who can only scan tickets can save scans', async () => {
        const scanner = await createWebshopAdmin({ level: PermissionLevel.None, accessRights: [AccessRight.WebshopScanTickets] });

        await patchTickets({ webshop, user: scanner, patches: [scanPatch(ticket)] });

        expect((await Ticket.getByID(ticket.id))!.scannedAt).not.toBeNull();
    });

    test('a user with read access cannot save scans', async () => {
        const reader = await createWebshopAdmin({ level: PermissionLevel.Read });

        await expect(patchTickets({ webshop, user: reader, patches: [scanPatch(ticket)] }))
            .rejects.toThrow(STExpect.errorWithCode('not_found'));

        expect((await Ticket.getByID(ticket.id))!.scannedAt).toBeNull();
    });
});

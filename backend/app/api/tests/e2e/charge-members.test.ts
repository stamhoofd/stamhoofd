import { Request, Response } from '@simonbackx/simple-endpoints';
import { MemberFactory, Organization, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { BalanceItemWithPayments, ChargeMembersRequest, LimitedFilteredRequest, PermissionLevel, Permissions, StamhoofdFilter, Version } from '@stamhoofd/structures';
import { ChargeMembersEndpoint } from '../../src/endpoints/admin/members/ChargeMembersEndpoint';
import { GetMemberBalanceEndpoint } from '../../src/endpoints/organization/dashboard/payments/GetMemberBalanceEndpoint';
import { testServer } from '../helpers/TestServer';

describe('E2E.ChargeMembers', () => {
    const chargeMembersEndpoint = new ChargeMembersEndpoint();
    const memberBalanceEndpoint = new GetMemberBalanceEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let admin: User;
    let adminToken: Token;

    const postCharge = async (filter: StamhoofdFilter, body: ChargeMembersRequest, token: Token) => {
        const request = Request.buildJson('POST', `/v${Version}/admin/charge-members`, undefined, body);
        const filterRequest = new LimitedFilteredRequest({
            filter,
            limit: 100,
        });
        request.query = filterRequest.encode({ version: Version }) as any;
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(chargeMembersEndpoint, request);
    };

    const getBalance = async (memberId: string, organization: Organization, token: Token): Promise<Response<BalanceItemWithPayments[]>> => {
        const request = Request.buildJson('GET', `/v${Version}/organization/members/${memberId}/balance`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(memberBalanceEndpoint, request);
    };

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        organization = await new OrganizationFactory({ period })
            .create();

        admin = await new UserFactory({
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        })
            .create();

        admin.organizationId = null;
        await admin.save();

        adminToken = await Token.createToken(admin);
    });

    test('Should fail if user does not have full platform access', async () => {
        // arrange
        const member1 = await new MemberFactory({ organization }).create();

        const member2 = await new MemberFactory({ organization }).create();

        const filter: StamhoofdFilter = {
            id: {
                $in: [member1.id, member2.id],
            },
        };

        const body = ChargeMembersRequest.create({
            organizationId: organization.id,
            description: 'test description',
            price: 3,
            amount: 4,
            dueAt: new Date(2023, 0, 10),
            createdAt: new Date(2023, 0, 4),
        });

        const user = await new UserFactory({
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        })
            .create();

        user.organizationId = null;

        await user.save();

        const token = await Token.createToken(user);

        await expect(async () => await postCharge(filter, body, token))
            .rejects
            .toThrow('You do not have permissions for this action');
    });

    test('Should create balance items for members', async () => {
        // arrange
        const member1 = await new MemberFactory({ organization }).create();

        const member2 = await new MemberFactory({ organization }).create();

        const filter: StamhoofdFilter = {
            id: {
                $in: [member1.id, member2.id],
            },
        };

        const body = ChargeMembersRequest.create({
            organizationId: organization.id,
            description: 'test description',
            price: 3,
            amount: 4,
            dueAt: new Date(2023, 0, 10),
            createdAt: new Date(2023, 0, 4),
        });

        const result = await postCharge(filter, body, adminToken);
        expect(result).toBeDefined();
        expect(result.body).toBeUndefined();

        // act and assert
        const testBalanceResponse = (response: Response<BalanceItemWithPayments[]>) => {
            expect(response).toBeDefined();
            expect(response.body.length).toBe(1);
            const balanceItem1 = response.body[0];
            expect(balanceItem1.price).toEqual(12);
            expect(balanceItem1.amount).toEqual(body.amount);
            expect(balanceItem1.description).toEqual(body.description);
            expect(balanceItem1.organizationId).toEqual(body.organizationId);
            // const dueAt = balanceItem1.dueAt!;
            expect(balanceItem1.dueAt).toEqual(body.dueAt);
            expect(balanceItem1.createdAt).toEqual(body.createdAt);
        };

        testBalanceResponse(await getBalance(member1.id, organization, adminToken));
        testBalanceResponse(await getBalance(member2.id, organization, adminToken));
    });

    test('Should fail if invalid request', async () => {
        // arrange
        const member1 = await new MemberFactory({ organization }).create();

        const member2 = await new MemberFactory({ organization }).create();

        const filter: StamhoofdFilter = {
            id: {
                $in: [member1.id, member2.id],
            },
        };

        const testCases: [body: ChargeMembersRequest, expectedErrorMessage: string][] = [
            // empty description
            [ChargeMembersRequest.create({
                organizationId: organization.id,
                description: ' ',
                price: 3,
                amount: 4,
                dueAt: new Date(2023, 0, 10),
                createdAt: new Date(2023, 0, 4),
            }), 'Invalid description'],

            // price 0
            [ChargeMembersRequest.create({
                organizationId: organization.id,
                description: 'test description',
                price: 0,
                amount: 4,
                dueAt: new Date(2023, 0, 10),
                createdAt: new Date(2023, 0, 4),
            }), 'Invalid price'],

            // amount 0
            [ChargeMembersRequest.create({
                organizationId: organization.id,
                description: 'test description',
                price: 3,
                amount: 0,
                dueAt: new Date(2023, 0, 10),
                createdAt: new Date(2023, 0, 4),
            }), 'Invalid amount'],
        ];

        // act and assert
        for (const [body, expectedErrorMessage] of testCases) {
            await expect(async () => await postCharge(filter, body, adminToken))
                .rejects
                .toThrow(expectedErrorMessage);
        }
    });
});

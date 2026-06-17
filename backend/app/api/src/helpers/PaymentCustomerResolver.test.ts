import { BalanceItem, Member, Order, Organization, Payment, User } from '@stamhoofd/models';
import { Address, Company, Country, MemberDetails, OrderData, Parent, ParentType } from '@stamhoofd/structures';
import { determinePaymentCustomer } from './PaymentCustomerResolver.js';

describe('PaymentCustomerResolver', () => {
    function createPayment(props: Partial<Pick<Payment, 'payingUserId' | 'payingOrganizationId'>> = {}): Payment {
        const payment = new Payment();
        payment.id = 'payment-1';
        payment.payingUserId = props.payingUserId ?? null;
        payment.payingOrganizationId = props.payingOrganizationId ?? null;
        return payment;
    }

    function createBalanceItem(props: Partial<Pick<BalanceItem, 'id' | 'memberId' | 'userId' | 'orderId' | 'payingOrganizationId'>>): BalanceItem {
        const balanceItem = new BalanceItem();
        balanceItem.id = props.id ?? 'balance-item-1';
        balanceItem.memberId = props.memberId ?? null;
        balanceItem.userId = props.userId ?? null;
        balanceItem.orderId = props.orderId ?? null;
        balanceItem.payingOrganizationId = props.payingOrganizationId ?? null;
        return balanceItem;
    }

    function createUser(props: { id: string; firstName?: string | null; lastName?: string | null; email: string }): User {
        const user = new User();
        user.id = props.id;
        user.firstName = props.firstName ?? null;
        user.lastName = props.lastName ?? null;
        user.email = props.email;
        return user;
    }

    function createMember(id: string, details: MemberDetails): Member {
        const member = new Member();
        member.id = id;
        member.details = details;
        return member;
    }

    const emptyRelations = {
        balanceItems: [] as BalanceItem[],
        members: [] as Member[],
        users: [] as User[],
        orders: [] as Order[],
        payingOrganizations: [] as Organization[],
    };

    it('returns the company of the paying organization', () => {
        const organization = new Organization();
        organization.id = 'org-1';
        organization.name = 'My Organization';
        organization.address = Address.createDefault(Country.Belgium);
        organization.meta = { companies: [] } as any;

        const payment = createPayment({ payingOrganizationId: 'org-1' });

        const customer = determinePaymentCustomer(payment, {
            ...emptyRelations,
            payingOrganizations: [organization],
        });

        expect(customer).not.toBeNull();
        expect(customer!.company).not.toBeNull();
        expect(customer!.company!.name).toBe('My Organization');
    });

    it('returns the paying user', () => {
        const payment = createPayment({ payingUserId: 'user-1' });
        const user = createUser({ id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' });

        const customer = determinePaymentCustomer(payment, {
            ...emptyRelations,
            users: [user],
        });

        expect(customer).not.toBeNull();
        expect(customer!.firstName).toBe('John');
        expect(customer!.lastName).toBe('Doe');
        expect(customer!.email).toBe('john@example.com');
    });

    it('falls back to a member linked to a balance item', () => {
        const payment = createPayment();
        const details = MemberDetails.create({
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            birthDay: new Date(1990, 0, 1),
        });
        const member = createMember('member-1', details);
        const balanceItem = createBalanceItem({ id: 'b1', memberId: 'member-1' });

        const customer = determinePaymentCustomer(payment, {
            ...emptyRelations,
            balanceItems: [balanceItem],
            members: [member],
        });

        expect(customer).not.toBeNull();
        expect(customer!.firstName).toBe('Jane');
        expect(customer!.lastName).toBe('Smith');
        expect(customer!.email).toBe('jane@example.com');
    });

    it('uses the parent of a young member', () => {
        const payment = createPayment();
        const details = MemberDetails.create({
            firstName: 'Kid',
            lastName: 'Smith',
            birthDay: new Date(2020, 0, 1),
            parents: [
                Parent.create({
                    type: ParentType.Mother,
                    firstName: 'Mom',
                    lastName: 'Smith',
                    email: 'mom@example.com',
                }),
            ],
        });
        const member = createMember('member-1', details);
        const balanceItem = createBalanceItem({ id: 'b1', memberId: 'member-1' });

        const customer = determinePaymentCustomer(payment, {
            ...emptyRelations,
            balanceItems: [balanceItem],
            members: [member],
        });

        expect(customer).not.toBeNull();
        expect(customer!.firstName).toBe('Mom');
        expect(customer!.email).toBe('mom@example.com');
    });

    it('falls back to a user linked to a balance item', () => {
        const payment = createPayment();
        const user = createUser({ id: 'user-2', firstName: 'Linked', lastName: 'User', email: 'linked@example.com' });
        const balanceItem = createBalanceItem({ id: 'b1', userId: 'user-2' });

        const customer = determinePaymentCustomer(payment, {
            ...emptyRelations,
            balanceItems: [balanceItem],
            users: [user],
        });

        expect(customer).not.toBeNull();
        expect(customer!.email).toBe('linked@example.com');
    });

    it('falls back to the customer of a linked order', () => {
        const payment = createPayment();
        const order = new Order();
        order.id = 'order-1';
        order.data = OrderData.create({});
        order.data.customer.firstName = 'Order';
        order.data.customer.lastName = 'Customer';
        order.data.customer.email = 'order@example.com';
        const balanceItem = createBalanceItem({ id: 'b1', orderId: 'order-1' });

        const customer = determinePaymentCustomer(payment, {
            ...emptyRelations,
            balanceItems: [balanceItem],
            orders: [order],
        });

        expect(customer).not.toBeNull();
        expect(customer!.email).toBe('order@example.com');
    });

    it('prefers the paying organization over a linked member', () => {
        const organization = new Organization();
        organization.id = 'org-1';
        organization.name = 'My Organization';
        organization.address = Address.createDefault(Country.Belgium);
        organization.meta = { companies: [Company.create({ name: 'My Company' })] } as any;

        const payment = createPayment({ payingOrganizationId: 'org-1' });
        const details = MemberDetails.create({ firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', birthDay: new Date(1990, 0, 1) });
        const member = createMember('member-1', details);
        const balanceItem = createBalanceItem({ id: 'b1', memberId: 'member-1' });

        const customer = determinePaymentCustomer(payment, {
            ...emptyRelations,
            balanceItems: [balanceItem],
            members: [member],
            payingOrganizations: [organization],
        });

        expect(customer).not.toBeNull();
        expect(customer!.company!.name).toBe('My Company');
    });

    it('returns null when no information is available', () => {
        const payment = createPayment();
        const balanceItem = createBalanceItem({ id: 'b1' });

        const customer = determinePaymentCustomer(payment, {
            ...emptyRelations,
            balanceItems: [balanceItem],
        });

        expect(customer).toBeNull();
    });
});

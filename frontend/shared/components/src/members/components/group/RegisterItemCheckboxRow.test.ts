import { Group, GroupSettings, MemberDetails, MemberWithRegistrationsBlob, Organization, OrganizationRecordsConfiguration, Platform, PlatformFamily, PlatformMember, RecordCategory, RecordSettings, RecordTextAnswer, RecordType, RegisterCheckout, TranslatedString } from '@stamhoofd/structures';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { nextTick } from 'vue';
import Checkbox from '#inputs/Checkbox.vue';
import STListItem from '#layout/STListItem.vue';
import RegisterItemCheckboxRow from './RegisterItemCheckboxRow.vue';

const { checkoutRegisterItem } = vi.hoisted(() => ({ checkoutRegisterItem: vi.fn() }));
vi.mock('#members/checkout/useCheckoutRegisterItem.ts', () => ({
    useCheckoutRegisterItem: () => checkoutRegisterItem,
}));

function renderRow({ answered, asOrganization }: { answered: boolean; asOrganization: 'owner' | 'other' }) {
    const record = RecordSettings.create({ name: TranslatedString.create('KAVO-ID'), type: RecordType.Text, required: true });

    const groupOrganization = Organization.create({});
    groupOrganization.meta.recordsConfiguration = OrganizationRecordsConfiguration.create({
        recordCategories: [RecordCategory.create({ name: TranslatedString.create('Gegevens'), records: [record] })],
    });

    const otherOrganization = Organization.create({});
    const family = new PlatformFamily({ platform: Platform.create({}), contextOrganization: otherOrganization });

    const details = MemberDetails.create({ firstName: 'Jan', lastName: 'Peeters', birthDay: new Date(2010, 0, 1) });
    if (answered) {
        details.recordAnswers.set(record.id, RecordTextAnswer.create({ settings: record, value: '123' }));
    }

    const member = new PlatformMember({
        family,
        member: MemberWithRegistrationsBlob.create({ registrations: [], details }),
    });
    family.add(member);

    const checkout = new RegisterCheckout();
    checkout.defaultOrganization = groupOrganization;
    checkout.asOrganizationId = asOrganization === 'owner' ? groupOrganization.id : otherOrganization.id;
    family.checkout = checkout;

    const group = Group.create({
        organizationId: groupOrganization.id,
        periodId: groupOrganization.period.period.id,
        settings: GroupSettings.create({ allowRegistrationsByOrganization: true }),
    });

    render(RegisterItemCheckboxRow, {
        props: { member, group, groupOrganization, checkout },
        global: {
            components: { Checkbox, STListItem },
            provide: {
                $context: { organization: otherOrganization, user: null },
                stamhoofd_app: 'dashboard',
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t,
                    formatDate: (date: Date) => date.toISOString(),
                } as any,
            },
        },
    });

    return { checkout };
}

async function toggle() {
    document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await nextTick();
}

describe('RegisterItemCheckboxRow', () => {
    beforeEach(() => {
        checkoutRegisterItem.mockReset();
    });

    describe('registering for another organization', () => {
        test('asks for missing member data instead of adding the member to the cart', async () => {
            const { checkout } = renderRow({ answered: false, asOrganization: 'other' });

            await toggle();

            expect(checkoutRegisterItem).toHaveBeenCalledOnce();
            expect(checkout.cart.items).toHaveLength(0);
        });

        test('adds a member with complete data to the cart without extra steps', async () => {
            const { checkout } = renderRow({ answered: true, asOrganization: 'other' });

            await toggle();

            expect(checkoutRegisterItem).not.toHaveBeenCalled();
            expect(checkout.cart.items).toHaveLength(1);
        });
    });

    test('admins of the organization that owns the group can skip missing member data', async () => {
        const { checkout } = renderRow({ answered: false, asOrganization: 'owner' });

        await toggle();

        expect(checkoutRegisterItem).not.toHaveBeenCalled();
        expect(checkout.cart.items).toHaveLength(1);
    });
});

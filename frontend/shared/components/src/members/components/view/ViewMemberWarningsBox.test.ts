import { BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, Platform, PlatformFamily, PlatformMember, PropertyFilter, UserWithMembers } from '@stamhoofd/structures';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import ViewMemberWarningsBox from './ViewMemberWarningsBox.vue';

function createMember() {
    const platform = Platform.create({});
    platform.config.recordsConfiguration.nationalRegisterNumber = new PropertyFilter(null, null);

    const family = new PlatformFamily({ platform });
    const member = new PlatformMember({
        family,
        member: MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                birthDay: new Date(2010, 0, 1),
                firstName: 'Jan',
                lastName: 'Peeters',
                severeDisability: BooleanStatus.create({ value: true }),
            }),
        }),
    });
    family.add(member);
    return member;
}

function renderBox(hasFullAccess: boolean) {
    const member = createMember();
    const user = UserWithMembers.create({ email: 'admin@example.com' });

    return render(ViewMemberWarningsBox, {
        props: {
            member,
        },
        global: {
            provide: {
                $context: {
                    auth: {
                        hasFullAccess: () => hasFullAccess,
                        user,
                    },
                    organization: null,
                    platform: member.family.platform,
                    user: null,
                },
                stamhoofd_app: 'dashboard',
            },
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                } as any,
            },
        },
    });
}

function severeDisabilityWarning(): HTMLElement | undefined {
    return Array.from(document.querySelectorAll<HTMLElement>('.member-records .text'))
        .find(element => element.textContent?.includes('Heeft recht op een fiscaal attest kinderopvang tot 21 jaar'));
}

test('shows the severe disability warning to full administrators', () => {
    renderBox(true);

    expect(severeDisabilityWarning()).toBeDefined();
});

test('shows the severe disability warning to users without full access', () => {
    renderBox(false);

    expect(severeDisabilityWarning()).toBeDefined();
});

import { MemberDetails, MemberResponsibility, MemberResponsibilityRecord, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import ViewMemberJudicialRecordBox from './ViewMemberJudicialRecordBox.vue';

type MemberOptions = {
    /** Null leaves the platform with a responsibility that never asks for an extract. */
    minimumAge?: number | null;
    birthDay?: Date;
};

function createMember({ minimumAge = 18, birthDay = new Date(1990, 0, 1) }: MemberOptions = {}) {
    const responsibility = MemberResponsibility.create({
        name: 'Leiding',
        judicialRecordMinimumAge: minimumAge,
    });

    const platform = Platform.create({});
    platform.config.responsibilities.push(responsibility);

    const organization = Organization.create({ name: 'KSA Sint-Jan' });
    const family = new PlatformFamily({ platform, contextOrganization: organization });

    const blob = MemberWithRegistrationsBlob.create({
        organizationId: organization.id,
        details: MemberDetails.create({
            firstName: 'Lotte',
            lastName: 'Peeters',
            birthDay,
        }),
    });
    blob.responsibilities.push(MemberResponsibilityRecord.create({
        memberId: blob.id,
        organizationId: organization.id,
        responsibilityId: responsibility.id,
        startDate: new Date(2020, 0, 1),
    }));

    const member = new PlatformMember({ family, member: blob });
    family.add(member);

    return { member: reactive(member) as unknown as PlatformMember, platform, organization };
}

function renderBox(options: MemberOptions & { canAccessPlatformMember?: (member: PlatformMember, level: PermissionLevel) => boolean } = {}) {
    const { member, platform, organization } = createMember(options);
    const canAccessPlatformMember = options.canAccessPlatformMember ?? (() => true);
    const present = vi.fn().mockResolvedValue(undefined);

    const screen = render(ViewMemberJudicialRecordBox, {
        props: { member },
        global: {
            components: { STList, STListItem },
            provide: {
                $context: {
                    auth: { canAccessPlatformMember },
                    organization,
                    platform,
                },
                reactive_navigation_present: present,
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_dismiss: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_push: vi.fn().mockResolvedValue(undefined),
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t,
                    STAMHOOFD: (globalThis as any).STAMHOOFD,
                } as any,
            },
        },
    });

    return { screen, member, present };
}

function uploadButton(): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>('button[data-testid="judicial-record-upload"]');
}

test('offers to upload for a member whose extract is required', () => {
    renderBox();

    expect(uploadButton()?.textContent).toContain('Uploaden voor Lotte');
});

test('does not offer to upload without full access to the member', () => {
    renderBox({ canAccessPlatformMember: (_member, level) => level !== PermissionLevel.Full });

    expect(uploadButton()).toBeNull();
});

test('does not offer to upload while no extract is required', () => {
    renderBox({ birthDay: new Date(2020, 0, 1) });

    expect(uploadButton()).toBeNull();
});

test('shows the status even when no extract is required', () => {
    renderBox({ birthDay: new Date(2020, 0, 1) });

    expect(document.body.textContent).toContain('Niet vereist');
});

test('the block disappears when no responsibility asks for an extract', () => {
    renderBox({ minimumAge: null });

    expect(document.body.textContent).not.toContain('Uittreksel uit het strafregister');
});

test('opens the delivery flow on behalf of the member', async () => {
    const { present, member } = renderBox();

    await userEvent.click(uploadButton()!);

    expect(present).toHaveBeenCalledTimes(1);
    const options = present.mock.calls[0][0];
    expect(options.modalDisplayStyle).toBe('popup');

    const root = options.components[0].properties.root;
    const step = await root.properties.promise();
    expect(step.properties.onBehalfOfMember).toBe(true);
    expect(step.properties.member).toBe(member);
    expect(step.properties.stepNumber).toBe(1);
});

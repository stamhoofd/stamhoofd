import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { Group, MembersBlob, MemberWithRegistrationsBlob, Organization, Platform, RegisterItem } from '@stamhoofd/structures';
import { PlatformFamilyHelper } from '@stamhoofd/structures/helpers/PlatformFamilyHelper.js';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';
import { shallowRef, toRaw } from 'vue';
import type { RegisterItemCheckoutHandler } from '../../checkout/CheckoutSelectionHandlers';
import RegisterItemRow from './RegisterItemRow.vue';

test.each(['dashboard', 'admin', 'registration'])('forwards %s checkout editing with the local session and navigation', async (app) => {
    const platform = Platform.create({});
    const organization = Organization.create({});
    const family = PlatformFamilyHelper.fromBlob(MembersBlob.create({
        members: [MemberWithRegistrationsBlob.create({})],
    }), { platform });
    const group = Group.create({ organizationId: organization.id, periodId: organization.period.period.id });
    const item = RegisterItem.defaultFor(family.members[0], group, organization);
    vi.spyOn(item, 'showItemView', 'get').mockReturnValue(true);
    const context = new SessionContext(organization, platform);
    const handler = vi.fn<RegisterItemCheckoutHandler>().mockResolvedValue(undefined);
    const present = vi.fn();
    const show = vi.fn();
    const wrapper = shallowMount(RegisterItemRow, {
        props: { item, checkoutRegisterItemHandler: handler },
        global: {
            provide: {
                $context: context,
                stamhoofd_app: app,
                reactive_navigation_present: present,
                reactive_navigation_show: show,
                reactive_navigationController: shallowRef(null),
            },
            stubs: { STListItem: true },
        },
    });

    wrapper.findComponent({ name: 'STListItem' }).vm.$emit('click');
    await flushPromises();

    expect(handler).toHaveBeenCalledOnce();
    const options = handler.mock.calls[0][0];
    expect(toRaw(options.item)).toBe(item);
    expect(options.context).toBe(context);
    await options.navigate.present({ components: [] });
    await options.navigate.show({ components: [] });
    expect(present).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledOnce();
    expect(options.admin).toBe(app !== 'registration');
    expect(options.startCheckoutFlow).toBe(false);
    expect(options.displayOptions).toEqual({ action: 'present', modalDisplayStyle: 'popup' });
    wrapper.unmount();
    vi.restoreAllMocks();
});

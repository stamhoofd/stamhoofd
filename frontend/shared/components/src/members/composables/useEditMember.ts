import { usePresent } from '@simonbackx/vue-app-navigation';
import type { PlatformMember } from '@stamhoofd/structures';

import { useContext } from '#hooks/useContext.ts';
import { presentEditMember } from '#members/classes/MemberActionBuilder.ts';

export function useEditMember() {
    const present = usePresent();
    const context = useContext();

    return (member: PlatformMember) => presentEditMember({ member, present, context: context.value });
}

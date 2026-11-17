import type { ComponentWithProperties } from '@browser/navigation';
import { SGVLid } from '@stamhoofd/sgv';
import { MemberDetails, MemberWithRegistrationsBlob } from '@stamhoofd/structures';
import { describe, expect, test, vi } from 'vitest';
import { SGVGroupAdministration } from './SGVGroupAdministration.ts';
import { SGVOldMemberAction } from './SGVOldMemberAction.ts';
import { getDefaultGroepFuncties, SGVSyncReport } from './SGVSyncReport.ts';

vi.mock('@stamhoofd/components/containers/AsyncComponent.ts', () => ({
    AsyncComponent: (_loader: unknown, properties: Record<string, unknown>) => ({
        properties,
        setDisplayStyle() {
            return this;
        },
    }),
}));

vi.mock('@stamhoofd/components/overlays/Toast.ts', () => ({
    Toast: class {
        setHide() {
            return this;
        }

        show() {
            return this;
        }

        hide() {}
    },
}));

describe('SGVGroupAdministration.prepareSync', () => {
    const birthDay = new Date(2015, 2, 4);

    function createLid(id: string, firstName: string) {
        return new SGVLid({ id, firstName, lastName: 'Peeters', lidNummer: '', birthDay });
    }

    function createMember(firstName: string) {
        return MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({ firstName, lastName: 'Peeters', birthDay }),
        });
    }

    /** Runs prepareSync for unmatched SGV members that all have a managed functie, and returns the ids offered for removal. */
    async function getOfferedForRemoval(leden: SGVLid[], trialMembers: MemberWithRegistrationsBlob[]) {
        const functies = getDefaultGroepFuncties();
        const sgv = new SGVGroupAdministration({} as any, {} as any, {} as any, {} as any);
        sgv.functies = functies;
        sgv.leden = leden;
        vi.spyOn(sgv, 'fetchLid').mockImplementation(async id => ({
            id,
            functies: [{ groep: 'O1234', functie: functies[0].id }],
        }) as any);

        let offeredMembers: SGVLid[] = [];
        const present = vi.fn(async (component: ComponentWithProperties) => {
            offeredMembers = component.properties.members as SGVLid[];
            (component.properties.setAction as (action: SGVOldMemberAction) => void)(SGVOldMemberAction.Nothing);
        });

        await sgv.prepareSync(present as any, new SGVSyncReport(), [], trialMembers);
        return offeredMembers.map(lid => lid.id);
    }

    test('does not offer members in their trial period for removal', async () => {
        expect(
            await getOfferedForRemoval([createLid('trial', 'Proef'), createLid('stopped', 'Gestopt')], [createMember('Proef')]),
        ).toEqual(['stopped']);
    });

    test('does not offer members in their trial period for removal when their name has a typo', async () => {
        expect(
            await getOfferedForRemoval([createLid('trial', 'Proefje'), createLid('stopped', 'Gestopt')], [createMember('Proefjes')]),
        ).toEqual(['stopped']);
    });
});

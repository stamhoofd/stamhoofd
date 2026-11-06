import type { PlatformMember } from '@stamhoofd/structures';
import type { NavigationActions } from '../types/NavigationActions';

/**
 * What the steps have gathered so far. The delivery step puts the chosen pdf in it, the result step
 * uploads it. It is the only thing the steps share, so a step still knows nothing about the others.
 */
export type JudicialRecordDelivery = {
    file: File | null;
};

/**
 * Every step of the delivery flow takes these. The step numbers are injected by
 * judicialRecordDeliveryFlow, which owns the order, so no step has to know its own position
 * or which step follows it.
 */
export type JudicialRecordStepProps = {
    member: PlatformMember;
    /** An administrator delivering for the member confirms that the member gave consent, instead of giving it. */
    onBehalfOfMember: boolean;
    stepNumber: number;
    stepCount: number;
    delivery: JudicialRecordDelivery;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
    /** Leaves the whole flow, back to wherever it was opened from. */
    dismissHandler: (navigate: NavigationActions) => Promise<void>;
};

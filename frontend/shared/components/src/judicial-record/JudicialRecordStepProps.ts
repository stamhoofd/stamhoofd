import type { JudicialRecordCheckReport, JudicialRecordDeliveryStatus, PlatformMember } from '@stamhoofd/structures';
import type { NavigationActions } from '../types/NavigationActions';

/**
 * What the steps have gathered so far. The delivery step puts the chosen pdf in it; the control step
 * checks it, sends it in when nothing needs fixing and shows where that leaves the member. It is the
 * only thing the steps share, so a step still knows nothing about the others.
 */
export type JudicialRecordDelivery = {
    file: File | null;
    /**
     * Where FOD Justitie serves `file`, when it was fetched by the QR-code on a paper extract. A file
     * that was picked has none until the control step reads it off the document.
     */
    url: string | null;
    /** What the checks in the browser found in `file` */
    report: JudicialRecordCheckReport | null;
    /** What the backend answered once it has `file`, null while it does not have it */
    status: JudicialRecordDeliveryStatus | null;
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

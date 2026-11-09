import type { JudicialRecordCheckReport, JudicialRecordStatus, PlatformMember } from '@stamhoofd/structures';
import type { NavigationActions } from '../types/NavigationActions';

/** The only thing the steps share, so no step has to know about the others. */
export type JudicialRecordDelivery = {
    file: File | null;
    /**
     * Where FOD Justitie serves `file`, when it was fetched by the QR-code on a paper extract. A file
     * that was picked has none until the control step reads it off the document.
     */
    url: string | null;
    report: JudicialRecordCheckReport | null;
    /** Null for as long as the backend does not have `file`. */
    status: JudicialRecordStatus | null;
};

/**
 * The step numbers are injected by judicialRecordDeliveryFlow, which owns the order, so no step has
 * to know its own position or which step follows it.
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

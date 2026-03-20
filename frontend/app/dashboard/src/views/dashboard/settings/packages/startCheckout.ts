import { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { PackageCheckout } from '@stamhoofd/structures';
import type { DisplayOptions, NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { InvoiceStep } from './steps/InvoiceStep';

export async function startCheckout({ checkout, context, displayOptions }: { checkout: PackageCheckout; context: SessionContext; displayOptions: DisplayOptions }, navigate: NavigationActions) {
    const steps = [
        new InvoiceStep(checkout),
    ];

    const stepManager = new ViewStepsManager(steps, async (navigate: NavigationActions) => {
        // todo
    }, displayOptions);

    await stepManager.saveHandler(null, navigate);
}

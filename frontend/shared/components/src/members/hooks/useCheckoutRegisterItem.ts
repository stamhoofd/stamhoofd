import { RegisterItem } from "@stamhoofd/structures";
import { Toast } from "../../overlays/Toast";
import { useNavigationActions } from "../../types/NavigationActions";
import { MemberStepManager } from "../classes/MemberStepManager";
import { allMemberSteps } from "../classes/steps";
import { MemberRecordCategoryStep } from "../classes/steps/MemberRecordCategoryStep";

export function useCheckoutRegisterItem() {
    const navigate = useNavigationActions();

    return async (item: RegisterItem) => {
        const member = item.member;

        // Add it to the platform member
        member.family.pendingRegisterItems = [item];

        // Check which steps need a review or are not complete
        const steps = allMemberSteps.slice();

        for (const recordCategory of member.getAllRecordCategories()) {
            steps.push(new MemberRecordCategoryStep(recordCategory, item));
        }
        
        const manager = new MemberStepManager(member, steps, async (navigate) => {
            // Move the item to the cart
            member.family.checkout.cart.add(item);
            member.family.pendingRegisterItems = [];
            Toast.success('Inschrijving toegevoegd aan winkelmandje. Ga naar het winkelmandje als je alle inschrijvingen hebt toegevoegd om af te rekenen.').show();
            await navigate.dismiss({force: true})
        });

        await manager.saveHandler(null, navigate);
    }
}

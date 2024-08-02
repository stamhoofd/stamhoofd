import { ComponentWithProperties, ModalDisplayStyle, PushOptions, useDismiss, usePop, usePresent, useShow } from "@simonbackx/vue-app-navigation"

export type NavigationActions = {show: ReturnType<typeof useShow>, present: ReturnType<typeof usePresent>, dismiss: ReturnType<typeof useDismiss>, pop: ReturnType<typeof usePop>}

export function useNavigationActions(): NavigationActions {
    const show = useShow();
    const present = usePresent();
    const pop = usePop();
    const dismiss = useDismiss();

    return {show, present, pop, dismiss};
}

export type DisplayOptions = Omit<PushOptions, 'components'> & {
    action: 'show' | 'present'
}

export const defaultDisplayOptions = {action: 'present', modalDisplayStyle: 'popup'} as DisplayOptions

export function runDisplayOptions(pushOptions: PushOptions, displayOptions: DisplayOptions, navigate: NavigationActions) {
    if (displayOptions.action === 'show') {
        return navigate.show({...pushOptions, ...displayOptions})
    }
    return navigate.present({...pushOptions, ...displayOptions})

}

/**
 * Because some steps are optional, it is possible we arrive at some further step, and that step wans to either show or popup - but that 
 * depends whether the previous step did show a popup or not. This function will make sure the navigation is consistent.
 */
export function glueNavigationActions(didShowView: boolean, currentNavigate: NavigationActions, displayOptions?: DisplayOptions) {
    if (!displayOptions) {
        displayOptions = defaultDisplayOptions
    }
    
    if (didShowView || displayOptions.action !== 'present') {
        // Always show normally
        return currentNavigate
    }

    // show should upgrade to popup or sheet
    const newNavigate: NavigationActions = {
        ...currentNavigate,
        show: async (o) => {
            let options: PushOptions
            if (!(o as any).components) {
                options = ({ components: [o as ComponentWithProperties] });
            } else {
                options = o as PushOptions
            }

            await currentNavigate.present({...options, ...displayOptions})
        },
        dismiss: async () => {
            // noop: already dismissed
        },
        pop: async () => {
            // noop: already popped
        }
    }

    return newNavigate
}

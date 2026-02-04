import { TranslatedString } from '@stamhoofd/structures';
import { ErrorBox } from '../errors/ErrorBox';

export type SaveViewProps = {
    loading?: boolean;
    loadingView?: boolean;
    errorBox?: ErrorBox | null;
    deleting?: boolean;
    disabled?: boolean;
    title?: string | TranslatedString;
    saveText?: string;
    saveIcon?: string | null;
    saveButtonClass?: string | null;
    saveIconRight?: string | null;
    saveIconMobile?: string | null;
    saveBadge?: string | number | null;
    cancelText?: string | null;
    preferLargeButton?: boolean;
    addExtraCancel?: boolean;
    mainClass?: string;
};

export const SaveViewDefaults = {
    loading: false,
    loadingView: false,
    errorBox: null,
    deleting: false,
    disabled: false,
    title: '',
    saveText: () => $t(`bc6b2553-c28b-4e3b-aba3-4fdc2c23db6e`),
    saveIcon: null,
    saveButtonClass: 'primary',
    saveIconRight: null,
    saveIconMobile: null,
    saveBadge: null,
    cancelText: () => $t(`80651252-e037-46b2-8272-a1a030c54653`),
    preferLargeButton: false,
    addExtraCancel: false,
    mainClass: '',
};

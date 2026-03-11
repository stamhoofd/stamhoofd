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
    saveText: () => $t(`14abcd1e-7e65-4e84-be4c-ab2e162ae44d`),
    saveIcon: null,
    saveButtonClass: 'primary',
    saveIconRight: null,
    saveIconMobile: null,
    saveBadge: null,
    cancelText: () => $t(`11d2e292-fd08-4477-bd2a-dac599a9754c`),
    preferLargeButton: false,
    addExtraCancel: false,
    mainClass: '',
};

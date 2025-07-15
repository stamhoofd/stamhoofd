import { GeneralMemberDetailsMatcher } from '../GeneralMemberDetailsMatcher';

export class TextColumnMatcher extends GeneralMemberDetailsMatcher<string> {
    parse(v: string, current: string | undefined): string {
        return v || current || '';
    }
}

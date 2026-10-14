export enum UIDateFilterMode {
    GreaterThan = 'GreaterThan',
    LessThan = 'LessThan',
    Equals = 'Equals',
    NotEquals = 'NotEquals',
}

export interface DateUIFilterEditor {
    id: string;
    mode: UIDateFilterMode;
    value: Date | null;
    builder: {
        nullable: boolean;
    };
}

// These types need to be implemented in an external package

export interface XlsxTransformerColumn<T> {
    id: string;
    name: string;
    width: number;
    getValue(object: T): CellValue;
}

export interface XlsxTransformerSheet<A, B = A> {
    id: string;
    name: string;
    transform?: (data: A) => B[];
    columns: XlsxTransformerColumn<B>[];
}

export interface CellValue {
    value: string | number | Date | null;
    style?: CellStyleRequest;
}

/**
 * This should be implemented in a specific environment (e.g. nodejs, browser)
 * that can write Excel files, given input CellValues
 */
export interface XlsxWriterAdapter {
    addSheet(name: string): Promise<symbol>|symbol;
    addRow(sheet: symbol, values: CellValue[]): Promise<void>|void;

    /**
     * Called when all sheets have been added and all files are ready to be written
     */
    ready(): Promise<void>;
    
    // Depends on environment
    // the adapter should handle this (e.g. by saving to a file, which file location is set in the constructor)
    close(): Promise<void>;
    abort(): Promise<void>;
}

export type XlsxWorkbookFilter = {
    sheets: {
        id: string;
        columns: string[];
    }[]
}


export enum XlsxBuiltInNumberFormat {
    None = 0,
    Number = 1,
    Number2Decimal = 2,
    NumberWithThousandSeparator = 3,
    NumberWithThousandSeparator2Decimal = 4,
    CurrencyWithoutRed = 5,
    CurrencyWithRed = 6,
    Currency2DecimalWithoutRed = 7,
    Currency2DecimalWithRed = 8,

    Percentage = 9,
    Percentage2Decimal = 10,
    Scientific = 11,
    Fraction = 12,
    Fraction2 = 13,

    /**
     * m/d/yyyy (depends on user local environment)
     * In EU: 14/03/2022
     */
    DateSlash = 14,

    /**
     * d-mmm-yy
     * 14-Mar-22
     */
    DateShort = 15,

    /**
     * d-mmm
     * 14-Mar
     */
    DateShortNoYear = 16,

    /**
     * mmm-yy
     * Mar-22
     */
    DateMonthYear = 17,

    /**
     * h:mm AM/PM
     * 2:30 PM
     */
    TimeAMPM = 18,

    /**
     * h:mm:ss AM/PM
     * 2:30:15 PM
     */
    TimeSecondsAMPM = 19,

    /**
     * h:mm
     * 2:30
     */
    Time = 20,

    /**
     * h:mm:ss
     * 2:30:15
     */
    TimeSeconds = 21,

    /**
     * m/d/yyyy h:mm (depends on user local environment)
     * 14/03/2022 14:30
     */
    DateTimeSlash = 22,

    /**
     * mm:ss
     * 02:30
     */
    TimeMinutesSeconds = 45,

    /**
     * [h]:mm:ss
     * 26:30:15
     */
    TimeHoursMinutesSeconds = 46,

    /**
     * mm:ss.0
     * 02:30.0
     */
    TimeMinutesSecondsDecimal = 47,

    /**
     * ##0.0E+0
     * 1.2E+3
     */
    Scientific2 = 48,

    /**
     * @
     * Text
     */
    Text = 49,
}


export type NumberFormatOptions = {
    id?: XlsxBuiltInNumberFormat|number; // When using built in number formats
    formatCode?: string; // If overwriting a built in number format

    /**
     * Built in list of number formats - Excel supports.
     * 1 0
     * 2 0.00
     * 3 #,##0
     * 4 #,##0.00
     * 5 $#,##0_);($#,##0) // This ones needs replacing with the default currency of the user
     * 6 $#,##0_);[Red]($#,##0)  // This ones needs replacing with the default currency of the user
     * 7 $#,##0.00_);($#,##0.00)  // This ones needs replacing with the default currency of the user
     * 8 $#,##0.00_);[Red]($#,##0.00)  // This ones needs replacing with the default currency of the user
     *                  
     * 9 0%
     * 10 0.00%
     * 11 0.00E+00
     * 12 # ?/?
     * 13 # ??/??
     * 14 m/d/yyyy // depends on user local environment
     * 15 d-mmm-yy
     * 16 d-mmm
     * 17 mmm-yy
     * 18 h:mm AM/PM
     * 19 h:mm:ss AM/PM
     * 20 h:mm
     * 21 h:mm:ss
     * 22 m/d/yyyy h:mm // also depends on user local environment
     * 37 #,##0_);(#,##0)
     * 38 #,##0_);[Red](#,##0)
     * 39 #,##0.00_);(#,##0.00)
     * 40 #,##0.00_);[Red](#,##0.00)
     * 45 mm:ss
     * 46 [h]:mm:ss
     * 47 mm:ss.0
     * 48 ##0.0E+0
     * 49 @
     * 
     * 
     * Overrides:
     * 8: "€"\ #,##0.00;[Red]"€"\ \-#,##0.00
    */
}

export enum CellType {
    Boolean = 'b',
    Date = 'd',
    Error = 'e',
    InlineString = 'inlineStr',
    Number = 'n', // This is the default value
    SharedString = 's',
    Formula = 'str',
}

export type FontOptions = {
    size?: number; // sz
    bold?: boolean; // b
}

export type CellAlignmentOptions = {
    horizontal?: 'general' | 'center' | 'centerContinuous' | 'distributed' | 'justify' | 'fill' | 'left' | 'right',
    vertical?: 'bottom' | 'center' | 'distributed' | 'justify' | 'top',
    wrapText?: boolean;
}

export type CellStyleRequest = {
    font?: FontOptions;
    numberFormat?: NumberFormatOptions;
    alignment?: CellAlignmentOptions;
}

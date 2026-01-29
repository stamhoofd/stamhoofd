export type PriceBreakdownAction = {
    icon: string;
    handler?: (event: any) => void;
};

export type PriceBreakdown = {
    name: string;
    description?: string;
    price: number;
    action?: PriceBreakdownAction;
}[];

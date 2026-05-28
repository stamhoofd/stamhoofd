export type PriceBreakdownAction = {
    icon: string;
    handler?: (event: MouseEvent) => void | Promise<void>;
};

export type PriceBreakdown = {
    name: string;
    description?: string;
    price: number;
    action?: PriceBreakdownAction;
}[];

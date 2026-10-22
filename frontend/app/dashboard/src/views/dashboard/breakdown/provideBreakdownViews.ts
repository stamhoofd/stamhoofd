import { useProvideBreakdownViewLoaders } from './breakdownViewLoaders';

export function useProvideBreakdownViews() {
    useProvideBreakdownViewLoaders({
        payments: () => import('./PaymentBreakdownView.vue'),
        balanceItems: () => import('./BalanceItemBreakdownView.vue'),
        paymentsTable: () => import('../payments/PaymentsTableView.vue'),
        balanceItemsTable: () => import('../balance-items/BalanceItemsTableView.vue'),
    });
}

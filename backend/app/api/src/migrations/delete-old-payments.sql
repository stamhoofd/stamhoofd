DELETE payments FROM payments
	LEFT JOIN balance_item_payments ON balance_item_payments.paymentId = payments.id
	LEFT JOIN balance_items ON balance_items.id = balance_item_payments.balanceItemId
		and(balance_items.registrationId IS NOT NULL
			OR balance_items.orderId IS NOT NULL
			OR balance_items.memberId IS NOT NULL
			OR balance_items.userId IS NOT NULL)
	WHERE balance_items.id IS NULL
		AND payments.organizationId IS NOT NULL
		AND payments.method = 'Transfer';
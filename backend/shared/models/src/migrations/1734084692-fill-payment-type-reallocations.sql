UPDATE payments
SET
	`type` = 'Reallocation'
WHERE
	price = 0
	AND method = 'Unknown'
	AND EXISTS (
		SELECT
			*
		FROM
			balance_item_payments
		WHERE
			balance_item_payments.paymentId = payments.id
			AND balance_item_payments.price < 0
	);

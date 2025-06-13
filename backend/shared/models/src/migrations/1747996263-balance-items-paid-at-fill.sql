update balance_items set paidAt = IF(pricePaid != 0, updatedAt, null);

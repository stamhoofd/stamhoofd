update balance_items set `type` = 'Order' where orderId is not null;
update balance_items set `type` = 'Registration' where registrationId is not null;

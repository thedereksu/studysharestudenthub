
ALTER TABLE public.credit_transactions DROP CONSTRAINT credit_transactions_type_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_type_check
  CHECK (type = ANY (ARRAY['purchase','material_purchase','admin_grant','admin_adjustment','refund','promotion_purchase','badge_purchase','request_reservation','request_refund','request_payment','request_reward']));

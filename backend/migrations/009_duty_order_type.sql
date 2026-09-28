ALTER TABLE duty_orders
    ADD COLUMN duty_type_id INT NULL AFTER order_month,
    ADD INDEX idx_duty_order_type (duty_type_id),
    ADD CONSTRAINT fk_duty_order_type FOREIGN KEY (duty_type_id) REFERENCES duty_types(id) ON DELETE RESTRICT;


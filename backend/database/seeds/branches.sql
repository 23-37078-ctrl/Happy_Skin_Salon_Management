INSERT INTO branches (id, name, address, phone, is_active)
VALUES
  (1, 'Happy Skin Main Branch', 'Main Branch', '0917-000-0000', TRUE),
  (2, 'Happy Skin Lipa Branch', 'Lipa City, Batangas', '0917-111-2222', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  address = VALUES(address),
  phone = VALUES(phone),
  is_active = VALUES(is_active);

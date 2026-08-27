INSERT INTO branches (id, name, address, phone, is_active)
VALUES
  (1, 'Happy Skin Main Branch', '22 Malingap Street, Teachers Village, Quezon City', '0917-000-0000', TRUE),
  (2, 'Happy Skin Lipa Branch', '198 Balete Drive (near Balete Lake)', '0917-111-2222', TRUE),
  (3, 'Happy Skin Cavite Branch', 'Alfonso, Cavite', '0917-100-0003', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  address = VALUES(address),
  phone = VALUES(phone),
  is_active = VALUES(is_active);

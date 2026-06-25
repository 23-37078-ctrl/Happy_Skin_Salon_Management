-- Demo staff account for checking the staff portal.
-- Email: staff.demo@happyskinsalon.com
-- Password: StaffDemo123!

INSERT INTO branches (id, name, address, phone, is_active)
VALUES (1, 'Happy Skin Main Branch', 'Main Branch', '0917-000-0000', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  address = VALUES(address),
  phone = VALUES(phone),
  is_active = TRUE;

INSERT INTO users (
  full_name,
  email,
  password_hash,
  role,
  branch_id,
  email_verified,
  verified_at
)
VALUES (
  'Demo Staff',
  'staff.demo@happyskinsalon.com',
  '$argon2id$v=19$m=65536,t=3,p=4$UyoFQOg9Z+w9p1SqVcq5Vw$thNTKfDHnUkLgAUz5bIhqrq62TMswieFQYSSDBdJCb0',
  'staff',
  1,
  TRUE,
  NOW()
)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  branch_id = VALUES(branch_id),
  email_verified = TRUE,
  verified_at = COALESCE(verified_at, NOW());

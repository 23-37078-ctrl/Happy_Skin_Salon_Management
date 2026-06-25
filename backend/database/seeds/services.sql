INSERT INTO services (id, name, description, price, duration_minutes, image_url, is_active)
VALUES
  (
    1,
    'Signature Facial',
    'Deep cleansing facial for refreshed and glowing skin.',
    899.00,
    60,
    '/images/services/signature-facial.jpg',
    TRUE
  ),
  (
    2,
    'Diamond Peel',
    'Gentle exfoliation service for smoother skin texture.',
    1299.00,
    75,
    '/images/services/diamond-peel.jpg',
    TRUE
  ),
  (
    3,
    'Brow Care',
    'Brow shaping and grooming for a polished salon visit.',
    349.00,
    30,
    '/images/services/brow-care.jpg',
    TRUE
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price = VALUES(price),
  duration_minutes = VALUES(duration_minutes),
  image_url = VALUES(image_url),
  is_active = VALUES(is_active);

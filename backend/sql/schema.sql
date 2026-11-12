CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_credit NUMERIC(10, 2) NOT NULL DEFAULT 0
  CHECK (store_credit >= 0);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  genre TEXT,
  description TEXT,
  condition TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE products DROP COLUMN IF EXISTS listing_type;
ALTER TABLE products DROP COLUMN IF EXISTS digital_url;

CREATE TABLE IF NOT EXISTS wishlists (
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (buyer_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id, product_id)
);

CREATE TABLE IF NOT EXISTS prohibited_words (
  id BIGSERIAL PRIMARY KEY,
  phrase TEXT NOT NULL UNIQUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id BIGSERIAL PRIMARY KEY,
  buyer_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  shipping_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'
  CHECK (refund_status IN ('none', 'requested', 'approved', 'rejected', 'completed'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_state TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6, 5) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_credit_applied NUMERIC(10, 2) NOT NULL DEFAULT 0
  CHECK (store_credit_applied >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
  CHECK (payment_amount >= 0);

CREATE TABLE IF NOT EXISTS order_items (
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
CREATE INDEX IF NOT EXISTS products_seller_idx ON products(seller_id);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product_id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id BIGINT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'cancelled'));
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

CREATE TABLE IF NOT EXISTS refund_requests (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  refund_method TEXT NOT NULL DEFAULT 'original_payment'
    CHECK (refund_method IN ('original_payment', 'store_credit')),
  refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id)
);
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS refund_method TEXT NOT NULL DEFAULT 'original_payment'
  CHECK (refund_method IN ('original_payment', 'store_credit'));
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
  CHECK (refund_amount >= 0);
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
UPDATE refund_requests rr
SET refund_amount = o.total_amount
FROM orders o
WHERE o.id = rr.order_id AND rr.refund_amount = 0 AND o.total_amount > 0;
CREATE INDEX IF NOT EXISTS refund_requests_status_idx ON refund_requests(status);
DROP TABLE IF EXISTS digital_deliveries;

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);

-- Uploaded cover images, stored in the database. products.image_path holds /api/images/<id>.
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data BYTEA NOT NULL,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- รันใน Supabase SQL Editor ครั้งเดียวตอนตั้งระบบ
-- สร้างตาราง products พร้อม seed สินค้าชาใจทั้ง 10 รายการ

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mood text not null,       -- fresh / relax / focus / romance
  price numeric not null,
  stock integer not null default 0,
  created_at timestamptz default now()
);

insert into products (name, mood, price, stock) values
  ('ชาใจ Fresh ซอง 10 ถุง', 'fresh', 79, 30),
  ('ชาใจ Fresh ซอง 30 ถุง', 'fresh', 189, 20),
  ('ชาใจ Relax ซอง 10 ถุง', 'relax', 79, 30),
  ('ชาใจ Relax ซอง 30 ถุง', 'relax', 189, 20),
  ('ชาใจ Focus ซอง 10 ถุง', 'focus', 79, 30),
  ('ชาใจ Focus ซอง 30 ถุง', 'focus', 189, 20),
  ('ชาใจ Romance ซอง 10 ถุง', 'romance', 79, 30),
  ('ชาใจ Romance ซอง 30 ถุง', 'romance', 189, 20),
  ('ผงชาลาเต้ Relax', 'relax', 149, 15),
  ('ผงชาลาเต้ Romance', 'romance', 149, 15);

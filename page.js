'use client';

// app/sell/page.js — หน้าขายสินค้า (POS) สำหรับ "ชาใจ"
// ตัดสต๊อกในตาราง `products` ของ Supabase แล้วยิงแจ้งเตือนเข้า Telegram อัตโนมัติ
// (ดูตารางและข้อมูล seed ที่ supabase/products-seed.sql)

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { notifyAfterSale } from '@/lib/telegram';

// 👉 ถ้ามี supabase client กลางอยู่แล้ว (เช่น '@/lib/supabaseClient')
// ให้ import จากตรงนั้นแทน แล้วลบ 4 บรรทัดด้านล่างนี้ออก
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MOOD_LABELS = {
  fresh: 'สดชื่น',
  relax: 'ผ่อนคลาย',
  focus: 'โฟกัส',
  romance: 'โรแมนติก'
};

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSelling, setIsSelling] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, mood, price, stock')
      .order('mood', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('โหลดรายการสินค้าไม่สำเร็จ:', error);
      return;
    }
    setProducts(data || []);
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  async function handleSell(e) {
    e.preventDefault();
    if (!selectedProduct || quantity < 1) return;

    setIsSelling(true);
    setStatusMessage(null);

    try {
      if (quantity > selectedProduct.stock) {
        setStatusMessage({ type: 'error', text: 'สต๊อกไม่พอสำหรับจำนวนที่เลือก' });
        return;
      }

      const newStock = selectedProduct.stock - quantity;
      const totalPrice = selectedProduct.price * quantity;

      // ----- ตัดสต๊อกใน Supabase -----
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', selectedProduct.id);

      if (updateError) {
        console.error('ตัดสต๊อกไม่สำเร็จ:', updateError);
        setStatusMessage({ type: 'error', text: 'บันทึกการขายไม่สำเร็จ กรุณาลองใหม่' });
        return;
      }

      // ----- ตัดสต๊อกสำเร็จแล้ว ยิง Telegram แจ้งเตือน -----
      // ไม่ await — ยิงเบื้องหลัง ไม่บล็อก UI การขาย และ notifyAfterSale
      // จับ error ไว้ในตัวเองหมดแล้ว (ดู lib/telegram.js) จึงไม่กระทบระบบขาย
      notifyAfterSale({
        productName: selectedProduct.name,
        quantity,
        totalPrice,
        remainingStock: newStock
      });

      // ----- อัปเดต state ในหน้าให้ตรงกับสต๊อกใหม่ -----
      setProducts((prev) =>
        prev.map((p) => (p.id === selectedProduct.id ? { ...p, stock: newStock } : p))
      );

      setStatusMessage({
        type: 'success',
        text: `ขาย "${selectedProduct.name}" จำนวน ${quantity} ชิ้น สำเร็จ`
      });
      setQuantity(1);
    } catch (error) {
      console.error('เกิดข้อผิดพลาดระหว่างการขาย:', error);
      setStatusMessage({ type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setIsSelling(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>ขายสินค้า — ชาใจ</h1>
      <p style={{ color: '#777', marginTop: 0 }}>ตัดสต๊อกอัตโนมัติ พร้อมแจ้งเตือนเข้า Telegram</p>

      <form onSubmit={handleSell}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="product">สินค้า</label><br />
          <select
            id="product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">-- เลือกสินค้า --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                [{MOOD_LABELS[p.mood] || p.mood}] {p.name} — คงเหลือ {p.stock} ชิ้น
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="quantity">จำนวน</label><br />
          <input
            id="quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        {selectedProduct && (
          <p>ราคารวม: {(selectedProduct.price * quantity).toLocaleString('th-TH')} บาท</p>
        )}

        <button
          type="submit"
          disabled={isSelling || !selectedProductId}
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
        >
          {isSelling ? 'กำลังบันทึก...' : 'ยืนยันการขาย'}
        </button>
      </form>

      {statusMessage && (
        <p style={{ color: statusMessage.type === 'error' ? '#c0392b' : '#27ae60', marginTop: '1rem' }}>
          {statusMessage.text}
        </p>
      )}
    </main>
  );
}

// lib/telegram.js
//
// โมดูลส่งแจ้งเตือนเข้า Telegram Channel สำหรับระบบขาย (POS)
// ออกแบบให้ "ไม่มีวันทำให้การขายล้ม" — ทุกอย่างอยู่ใน try/catch
// ถ้า Telegram ยิงไม่ขึ้น (เน็ตหลุด, token ผิด, chat id ผิด ฯลฯ)
// ฟังก์ชันจะ log error แล้ว return false เฉยๆ ไม่ throw ออกไปรบกวนโค้ดฝั่งขาย

const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
const LOW_STOCK_THRESHOLD = 5;

/**
 * ฟังก์ชันหลักที่ยิง message ไปที่ Telegram Bot API
 * ใช้ภายในไฟล์นี้เท่านั้น (ไม่ export ออกไปข้างนอก)
 */
async function sendTelegramMessage(messageText) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[telegram] ไม่พบ TELEGRAM_BOT_TOKEN หรือ TELEGRAM_CHAT_ID ใน environment variables');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: messageText,
        parse_mode: 'HTML'
      })
    });

    const data = await res.json();

    if (!data.ok) {
      // Telegram ตอบกลับมาแต่บอกว่า error (เช่น token ผิด, chat id ผิด, HTML tag ไม่ถูก)
      console.error('[telegram] API ตอบกลับว่าล้มเหลว:', data.description);
      return false;
    }

    return true;
  } catch (error) {
    // เน็ตหลุด, fetch ไม่สำเร็จ, หรือ error อื่นๆ ที่ไม่คาดคิด
    console.error('[telegram] ส่งข้อความไม่สำเร็จ:', error);
    return false;
  }
}

function formatCurrency(amount) {
  return Number(amount).toLocaleString('th-TH');
}

function getCurrentThaiTime() {
  return new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

/**
 * งานที่ 1: แจ้งเตือนมีรายการขายใหม่
 *
 * เรียกใช้หลังตัดสต๊อกใน Supabase สำเร็จ
 *
 * @param {Object} order
 * @param {string} order.productName      ชื่อสินค้า
 * @param {number} order.quantity         จำนวนที่ขาย
 * @param {number} order.totalPrice       ราคารวม (บาท)
 * @param {number} order.remainingStock   สต๊อกคงเหลือหลังตัด
 */
export async function notifyNewOrder({ productName, quantity, totalPrice, remainingStock }) {
  const message =
    `🛍️ <b>มีรายการขายใหม่!</b>\n` +
    `- สินค้า: ${productName}\n` +
    `- จำนวน: ${quantity} ชิ้น\n` +
    `- ราคารวม: ${formatCurrency(totalPrice)} บาท\n` +
    `- สต๊อกคงเหลือปัจจุบัน: ${remainingStock} ชิ้น\n` +
    `- เวลา: ${getCurrentThaiTime()}`;

  return sendTelegramMessage(message);
}

/**
 * งานที่ 2: แจ้งเตือนสต๊อกใกล้หมด (เรียกแยกต่างหากจาก notifyNewOrder)
 *
 * @param {Object} product
 * @param {string} product.productName     ชื่อสินค้า
 * @param {number} product.remainingStock  สต๊อกคงเหลือหลังตัด
 */
export async function notifyLowStock({ productName, remainingStock }) {
  const message =
    `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
    `- สินค้า: ${productName}\n` +
    `- คงเหลือเพียง: ${remainingStock} ชิ้น\n` +
    `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`;

  return sendTelegramMessage(message);
}

/**
 * ฟังก์ชันรวม: เรียกทีเดียวหลังตัดสต๊อกสำเร็จ
 * จะส่ง "แจ้งเตือนขายใหม่" เสมอ และถ้าสต๊อกเหลือ <= 5 จะยิง "เตือนสต๊อกใกล้หมด" แยกอีกข้อความ
 *
 * ใช้ Promise.allSettled เพื่อให้ยิงพร้อมกันทั้งสองข้อความ (เร็วกว่า await ทีละอัน)
 * และต่อให้อันใดอันหนึ่งพังก็ไม่กระทบอีกอัน
 */
export async function notifyAfterSale({ productName, quantity, totalPrice, remainingStock }) {
  const tasks = [
    notifyNewOrder({ productName, quantity, totalPrice, remainingStock })
  ];

  if (remainingStock <= LOW_STOCK_THRESHOLD) {
    tasks.push(notifyLowStock({ productName, remainingStock }));
  }

  // allSettled การันตีว่าจะไม่มี exception หลุดออกไปจากฟังก์ชันนี้
  await Promise.allSettled(tasks);
}

/* ============================================================
   Room Scent — script.js
   ไฟล์เดียวใช้ร่วมกันทุกหน้า: product.html / order.html / admin.html
   ตรวจว่าอยู่หน้าไหนจาก element ที่มีอยู่จริงในหน้านั้น
   ============================================================ */

var ROOM_SCENT_CONFIG = {
  ORDER_ENDPOINT: 'https://script.google.com/macros/s/AKfycby5wf1MBOcyylUszTBWPSCXgPlAwuwb74aeqaKnoN1Xfkt5uFICyQAqhH4fz4QKgcUH/exec',
  ORDERS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSMC1bM6Qa6q0veQGoDOKW5AtoyJqP_fNjllbe-bIkq9rGCD1KZ6kopU9fqd9N4dy4hU9N6-km4gMua/pub?gid=0&single=true&output=csv'
};

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ============================================================
   1) product.html — โหลดสินค้า, กรองตาม mood, ลิงก์ไปสั่งซื้อ
   ============================================================ */
function initProductPage() {
  var productListEl = document.getElementById('product-list');
  var filterBarEl = document.getElementById('filter-bar');
  var emptyStateEl = document.getElementById('empty-state');

  var allProducts = [];
  var currentMood = 'all';
  var validMoods = ['fresh', 'relax', 'focus', 'romance'];

  var typeLabels = {
    bag: 'ชาซอง',
    latte: 'ผงชาลาเต้'
  };

  function renderProducts() {
    var filtered = currentMood === 'all'
      ? allProducts
      : allProducts.filter(function (p) { return p.mood === currentMood; });

    productListEl.innerHTML = '';

    if (filtered.length === 0) {
      if (emptyStateEl) emptyStateEl.classList.remove('hide');
      return;
    }
    if (emptyStateEl) emptyStateEl.classList.add('hide');

    filtered.forEach(function (product) {
      var card = document.createElement('article');
      card.className = 'product-card';
      card.setAttribute('data-mood', product.mood);

      var orderUrl = 'order.html?item=' + encodeURIComponent(product.name) +
                      '&price=' + encodeURIComponent(product.price);

      card.innerHTML =
        '<div class="product-card__media">' +
          '<img src="' + product.image + '" alt="' + product.name + '" loading="lazy">' +
        '</div>' +
        '<p class="product-card__type">' + (typeLabels[product.type] || product.type) + ' · ' + product.size + '</p>' +
        '<h3 class="product-card__name">' + product.name + '</h3>' +
        '<p class="product-card__desc">' + product.description + '</p>' +
        '<div class="product-card__foot">' +
          '<span class="price">' + product.price + '</span>' +
          '<a class="btn btn--solid" href="' + orderUrl + '">สั่งซื้อ</a>' +
        '</div>';

      productListEl.appendChild(card);
    });
  }

  function setActiveFilter(mood) {
    currentMood = mood;
    if (filterBarEl) {
      var buttons = filterBarEl.querySelectorAll('.filter');
      buttons.forEach(function (btn) {
        var isActive = btn.getAttribute('data-mood') === mood;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }
    renderProducts();
  }

  if (filterBarEl) {
    filterBarEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter');
      if (!btn) return;
      setActiveFilter(btn.getAttribute('data-mood'));
    });
  }

  fetch('products.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      allProducts = data.products || [];

      var params = new URLSearchParams(window.location.search);
      var moodParam = params.get('mood');

      if (moodParam && validMoods.indexOf(moodParam) !== -1) {
        setActiveFilter(moodParam);
      } else {
        renderProducts();
      }
    })
    .catch(function (error) {
      console.error(error);
      productListEl.innerHTML = '<p class="empty">โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>';
    });
}

/* ============================================================
   2) order.html — เติมข้อมูลจาก URL parameter, ส่งฟอร์มไป Apps Script
   ============================================================ */
function initOrderPage() {
  var form = document.getElementById('orderForm');
  var itemsInput = document.getElementById('items');
  var totalInput = document.getElementById('total');
  var customerNameInput = document.getElementById('customerName');
  var contactInput = document.getElementById('contact');
  var noteInput = document.getElementById('note');

  // เติมชื่อสินค้าและราคาจาก URL parameter ทันทีที่โหลดหน้า
  var params = new URLSearchParams(window.location.search);
  var itemParam = params.get('item');
  var priceParam = params.get('price');

  if (itemParam && itemsInput) {
    itemsInput.value = itemParam;
  }
  if (priceParam && totalInput) {
    totalInput.value = priceParam;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.setAttribute('aria-disabled', 'true');

    var payload = {
      customerName: customerNameInput.value,
      contact: contactInput.value,
      items: itemsInput.value,
      total: totalInput.value,
      note: noteInput ? noteInput.value : ''
    };

    fetch(ROOM_SCENT_CONFIG.ORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(function () {
        window.location.href = 'thankyou.html';
      })
      .catch(function (error) {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) submitBtn.removeAttribute('aria-disabled');
      });
  });
}

/* ============================================================
   3) admin.html — โหลด CSV จาก Google Sheet ที่เผยแพร่ไว้ แสดงเป็นตาราง
   ============================================================ */
function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');

  fetch(ROOM_SCENT_CONFIG.ORDERS_CSV_URL)
    .then(function (res) { return res.text(); })
    .then(function (csvText) {
      var rows = parseCSV(csvText);

      // ตัดแถวว่างท้ายไฟล์ทิ้ง
      rows = rows.filter(function (row) {
        return row.some(function (cell) { return cell.trim() !== ''; });
      });

      if (rows.length === 0) {
        renderEmptyRow('ยังไม่มีคำสั่งซื้อ');
        return;
      }

      // ถ้าแถวแรกไม่ใช่วันเวลาที่ parse ได้ ให้ถือว่าเป็นหัวตาราง แล้วตัดทิ้ง
      var firstCellAsDate = new Date(rows[0][0]);
      if (isNaN(firstCellAsDate.getTime())) {
        rows = rows.slice(1);
      }

      // ล่าสุดขึ้นก่อน (แถวใหม่ถูก appendRow ต่อท้ายเสมอ)
      rows.reverse();

      renderRows(rows);
    })
    .catch(function (error) {
      console.error(error);
      renderEmptyRow('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    });

  function renderRows(rows) {
    tbody.innerHTML = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      // คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
      for (var i = 0; i < 6; i++) {
        var td = document.createElement('td');
        td.textContent = row[i] !== undefined ? row[i] : '';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  function renderEmptyRow(message) {
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'empty';
    td.textContent = message;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  // ตัว parse CSV เอง รองรับฟิลด์ที่ครอบด้วย " และมีจุลภาค/บรรทัดใหม่อยู่ข้างใน
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      var next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(field);
          field = '';
        } else if (char === '\r') {
          // ข้าม \r เตรียมเจอ \n ต่อไป
        } else if (char === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
        } else {
          field += char;
        }
      }
    }

    // เก็บฟิลด์/แถวสุดท้ายถ้าไฟล์ไม่ได้จบด้วยขึ้นบรรทัดใหม่
    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }
}

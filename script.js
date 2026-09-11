// ============ KONFIGURASI JSONBIN ============
var JSONBIN_BIN_ID = "6aa3bcf6ac6210605abfd764";
var JSONBIN_MASTER_KEY = "$2a$10$RBQYiQpKVfGhk4a6p2bPAOPHM61q47Q0A.KNKqSYqfHDjU61.oM8K";
var JSONBIN_URL = "https://api.jsonbin.io/v3/b/" + JSONBIN_BIN_ID;

var ADMIN_PASSWORD = "oniyyimut";
var WA_NUMBER = "6285333938526";
var ITEMS_PER_PAGE = 6;

var isAdmin = false, currentPage = 1, filteredProducts = [], currentKategori = 'semua';
var productToBuy = null, appliedPromo = null, selectedRating = 5, confirmCallback = null;
var products = [], promos = [], testimonials = [];
var isSyncing = false;

function $(id) { return document.getElementById(id); }

// ============ KOMPRES FOTO ============
function compressImage(file, maxWidth, quality) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var width = img.width;
                var height = img.height;
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                var dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============ JSONBIN API ============
async function loadDataFromCloud() {
    try {
        var res = await fetch(JSONBIN_URL + "/latest", {
            method: 'GET',
            headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        var record = data.record || {};
        products = record.products || [];
        promos = record.promos || [];
        testimonials = record.testimonials || [];
        return true;
    } catch (e) {
        console.error('Load error:', e);
        try { products = JSON.parse(localStorage.getItem('vanss_products')) || []; } catch(x) { products = []; }
        try { promos = JSON.parse(localStorage.getItem('vanss_promos')) || []; } catch(x) { promos = []; }
        try { testimonials = JSON.parse(localStorage.getItem('vanss_testimonials')) || []; } catch(x) { testimonials = []; }
        return false;
    }
}

async function saveDataToCloud() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        localStorage.setItem('vanss_products', JSON.stringify(products));
        localStorage.setItem('vanss_promos', JSON.stringify(promos));
        localStorage.setItem('vanss_testimonials', JSON.stringify(testimonials));
        
        var payload = JSON.stringify({
            products: products,
            promos: promos,
            testimonials: testimonials
        });
        
        var sizeKB = (payload.length / 1024).toFixed(2);
        console.log('📤 Payload size:', sizeKB, 'KB');
        
        if (payload.length > 95000) {
            isSyncing = false;
            showToast('⚠️ Data terlalu besar (' + sizeKB + 'KB / maks 100KB)', 'error');
            return false;
        }
        
        var res = await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_MASTER_KEY
            },
            body: payload
        });
        
        if (!res.ok) {
            var errText = await res.text();
            console.error('Save failed:', res.status, errText);
            isSyncing = false;
            showToast('❌ Server: ' + res.status, 'error');
            return false;
        }
        
        isSyncing = false;
        return true;
    } catch (e) {
        console.error('Save error:', e);
        isSyncing = false;
        return false;
    }
}

function saveProducts() { saveDataToCloud(); }
function savePromos() { saveDataToCloud(); }
function saveTestimonials() { saveDataToCloud(); }

// ============ UTILITY ============
function showToast(msg, type) {
    type = type || 'info';
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.className = 'toast ' + type;
    void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._timeout); t._timeout = setTimeout(function() { t.classList.remove('show'); }, 3000);
}

function showConfirm(title, msg, cb) {
    var b = $('confirmModal'); if (!b) return;
    $('confirmTitle').textContent = title; $('confirmMessage').textContent = msg;
    confirmCallback = cb; b.classList.add('open');
}

function formatRupiah(n) { return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function isNew(t) { if (!t) return false; return (Date.now() - new Date(t).getTime()) / 86400000 < 3; }
function formatTanggal(iso) { return new Date(iso).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'}); }
function formatTanggalPanjang(iso) { if (!iso) return '-'; return new Date(iso).toLocaleDateString('id-ID', {weekday:'long',day:'numeric',month:'long',year:'numeric'}); }
function hitungHariTersisa(exp) { if (!exp) return null; var t = new Date(); t.setHours(0,0,0,0); var e = new Date(exp); e.setHours(23,59,59,999); return Math.ceil((e - t) / 86400000); }
function isPromoExpired(p) { if (!p.expired) return false; var t = new Date(); t.setHours(0,0,0,0); var e = new Date(p.expired); e.setHours(23,59,59,999); return t > e; }
function updateStats() { if ($('statTotal')) $('statTotal').textContent = products.length; if ($('statTestimoni')) $('statTestimoni').textContent = testimonials.length; if ($('testiCount')) $('testiCount').textContent = testimonials.length; }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

// ============ INIT ============
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var page = this.dataset.page;
            document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
            if (page === 'jualan') $('pageJualan').classList.add('active');
            else $('pageCurhatan').classList.add('active');
            window.scrollTo({top:0,behavior:'smooth'});
        });
    });
    bootApp();
});

async function bootApp() {
    await loadDataFromCloud();
    renderProducts();
    renderTestimoni();
}

// ============ RENDER PRODUK ============
function renderProducts() {
    var grid = $('produkGrid'); if (!grid) return;
    var q = ($('searchInput') ? $('searchInput').value : '').toLowerCase().trim();
    var temp = products.filter(function(p) {
        if (currentKategori !== 'semua' && p.kategori !== currentKategori) return false;
        return (p.nama || '').toLowerCase().includes(q) || String(p.harga).includes(q);
    });
    temp.sort(function(a, b) { return new Date(b.tanggal || 0) - new Date(a.tanggal || 0); });
    filteredProducts = temp;
    if (isAdmin) {
        $('adminStatus').innerHTML = '<span class="admin-badge">✓ Admin</span>';
        $('btnTambahProduk').style.display = 'inline-flex';
        $('btnKelolaPromo').style.display = 'inline-flex';
        $('btnAdminMode').innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        $('btnAdminMode').classList.add('active');
    } else {
        $('adminStatus').innerHTML = '';
        $('btnTambahProduk').style.display = 'none';
        $('btnKelolaPromo').style.display = 'none';
        $('btnAdminMode').innerHTML = '<i class="fas fa-user-shield"></i> Mode Admin';
        $('btnAdminMode').classList.remove('active');
    }
    var totalItems = filteredProducts.length;
    var totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * ITEMS_PER_PAGE;
    var pageItems = filteredProducts.slice(start, start + ITEMS_PER_PAGE);
    if (totalItems === 0) {
        grid.innerHTML = '<div class="empty"><i class="fas fa-box-open"></i><h3>' + (q ? 'Tidak ada produk' : 'Belum ada produk') + '</h3><p style="margin-top:8px">' + (isAdmin ? 'Klik Tambah Produk' : 'Admin belum menambahkan') + '</p></div>';
    } else {
        grid.innerHTML = pageItems.map(function(p) {
            var ri = products.indexOf(p);
            var badge = isNew(p.tanggal) ? '<span class="badge-new">✨ NEW</span>' : '';
            var foto = p.foto || 'https://placehold.co/400x300/1e293b/facc15?text=No+Image';
            return '<div class="produk-card"><div class="produk-img-wrapper">' + badge + '<img class="produk-img" src="' + foto + '" alt="' + escapeHtml(p.nama) + '"></div><div class="produk-info"><div class="produk-nama">' + escapeHtml(p.nama) + '</div>' + (p.deskripsi ? '<div class="produk-deskripsi">' + escapeHtml(p.deskripsi) + '</div>' : '') + '<div class="produk-harga">' + Number(p.harga).toLocaleString('id-ID') + '</div><div class="produk-actions"><button class="btn-wa" onclick="window.confirmBeli(' + ri + ')"><i class="fab fa-whatsapp"></i> Beli</button>' + (isAdmin ? '<button class="btn-edit" onclick="window.editProduct(' + ri + ')"><i class="fas fa-pen"></i></button><button class="btn-delete" onclick="window.deleteProduct(' + ri + ')"><i class="fas fa-trash"></i></button>' : '') + '</div></div></div>';
        }).join('');
    }
    renderPagination(totalPages); updateStats();
}

function renderPagination(totalPages) {
    var c = $('paginationContainer'); if (!c) return;
    if (totalPages <= 1) { c.innerHTML = ''; return; }
    var html = '';
    for (var i = 1; i <= totalPages; i++) html += '<button class="' + (i === currentPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
    c.innerHTML = html;
    c.querySelectorAll('button').forEach(function(btn) {
        btn.addEventListener('click', function() { currentPage = parseInt(this.dataset.page); renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); });
    });
}

// ============ BELI ============
window.confirmBeli = function(index) {
    var p = products[index]; if (!p) return;
    productToBuy = index; appliedPromo = null;
    $('konfirmasiDetail').innerHTML = '<p><strong>📦 Nama:</strong> ' + escapeHtml(p.nama) + '</p><p><strong>🏷️ Kategori:</strong> ' + (p.kategori === 'ML' ? 'Mobile Legends' : 'Free Fire') + '</p><p><strong>💰 Harga:</strong> ' + formatRupiah(p.harga) + '</p>' + (p.deskripsi ? '<p><strong>📝 Deskripsi:</strong> ' + escapeHtml(p.deskripsi) + '</p>' : '');
    $('inputKodePromo').value = '';
    $('promoMessage').className = 'promo-message'; $('promoMessage').textContent = '';
    $('hargaRingkasan').classList.remove('show');
    $('modalKonfirmasi').classList.add('open');
};

$('btnPakaiPromo').addEventListener('click', function() {
    if (productToBuy === null) return;
    var kode = $('inputKodePromo').value.trim().toUpperCase();
    var msg = $('promoMessage');
    var p = products[productToBuy]; if (!p) return;
    if (!kode) { msg.className = 'promo-message error show'; msg.textContent = '❌ Masukkan kode!'; return; }
    var promo = null;
    for (var i = 0; i < promos.length; i++) { if (promos[i].kode.toUpperCase() === kode) { promo = promos[i]; break; } }
    if (!promo) { msg.className = 'promo-message error show'; msg.textContent = '❌ Kode tidak ditemukan!'; appliedPromo = null; $('hargaRingkasan').classList.remove('show'); return; }
    if (isPromoExpired(promo)) { msg.className = 'promo-message error show'; msg.textContent = '❌ Kode kadaluarsa!'; appliedPromo = null; $('hargaRingkasan').classList.remove('show'); return; }
    appliedPromo = promo;
    var diskon = Math.round(p.harga * promo.diskon / 100);
    var total = p.harga - diskon;
    msg.className = 'promo-message success show';
    msg.textContent = '✅ Kode "' + promo.kode + '" berhasil! Diskon ' + promo.diskon + '%';
    $('ringkasanHargaAwal').textContent = formatRupiah(p.harga);
    $('ringkasanDiskon').textContent = '-' + formatRupiah(diskon);
    $('ringkasanTotal').textContent = formatRupiah(total);
    $('hargaRingkasan').classList.add('show');
});

$('btnKonfirmasiYa').addEventListener('click', function() {
    if (productToBuy === null) return;
    var p = products[productToBuy]; if (!p) return;
    var hargaAkhir = p.harga, pesanPromo = '';
    if (appliedPromo && !isPromoExpired(appliedPromo)) {
        var diskon = Math.round(p.harga * appliedPromo.diskon / 100);
        hargaAkhir = p.harga - diskon;
        pesanPromo = '\n• Kode Promo: ' + appliedPromo.kode + ' (diskon ' + appliedPromo.diskon + '%)\n• Potongan: -' + formatRupiah(diskon);
    }
    var msg = 'Halo kak, saya berminat membeli produk ini:\n• Nama: ' + p.nama + '\n• Kategori: ' + (p.kategori === 'ML' ? 'Mobile Legends' : 'Free Fire') + '\n• Harga: ' + formatRupiah(p.harga) + pesanPromo + (p.deskripsi ? '\n• Deskripsi: ' + p.deskripsi : '') + '\n\n💰 Total Bayar: ' + formatRupiah(hargaAkhir) + '\n\nApakah masih tersedia?';
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
    $('modalKonfirmasi').classList.remove('open');
    productToBuy = null; appliedPromo = null;
    showToast('✅ Lanjutkan chat WhatsApp', 'success');
});

$('btnKonfirmasiBatal').addEventListener('click', function() { $('modalKonfirmasi').classList.remove('open'); productToBuy = null; appliedPromo = null; });

// ============ ADMIN PRODUK ============
$('btnTambahProduk').addEventListener('click', function() {
    if (!isAdmin) return;
    $('modalTitle').innerText = 'Tambah Produk';
    $('inputNama').value = ''; $('inputHarga').value = ''; $('inputKategori').value = 'ML';
    $('inputDeskripsi').value = ''; $('inputFoto').value = '';
    $('fileText').innerText = 'Pilih foto'; $('editIndex').value = '-1';
    $('modalProduk').classList.add('open');
});

window.editProduct = function(index) {
    if (!isAdmin) return;
    var p = products[index]; if (!p) return;
    $('modalTitle').innerText = 'Edit Produk';
    $('inputNama').value = p.nama; $('inputHarga').value = p.harga;
    $('inputKategori').value = p.kategori; $('inputDeskripsi').value = p.deskripsi || '';
    $('fileText').innerText = p.foto ? 'Ganti foto' : 'Pilih foto';
    $('editIndex').value = index;
    $('modalProduk').classList.add('open');
};

window.deleteProduct = function(index) {
    if (!isAdmin) return;
    showConfirm('Hapus Produk?', 'Produk akan dihapus permanen.', async function() {
        products.splice(index, 1);
        renderProducts();
        showToast('⏳ Menyimpan...', 'info');
        var ok = await saveDataToCloud();
        if (ok) showToast('🗑️ Produk dihapus!', 'success');
    });
};

$('btnSimpan').addEventListener('click', async function() {
    if (!isAdmin) return;
    var nama = $('inputNama').value.trim();
    var harga = $('inputHarga').value.trim();
    var kategori = $('inputKategori').value;
    var deskripsi = $('inputDeskripsi').value.trim();
    var fileInput = $('inputFoto');
    var editIndex = parseInt($('editIndex').value);
    if (!nama || !harga) { showToast('⚠️ Isi nama dan harga!', 'error'); return; }
    if (isNaN(harga) || Number(harga) <= 0) { showToast('⚠️ Harga harus angka!', 'error'); return; }
    
    var saveProduct = async function(fotoData) {
        var p = { nama: nama, harga: Number(harga), kategori: kategori, deskripsi: deskripsi, foto: fotoData || '', tanggal: new Date().toISOString() };
        if (editIndex >= 0) { p.tanggal = products[editIndex].tanggal; products[editIndex] = p; }
        else { products.push(p); }
        $('modalProduk').classList.remove('open');
        renderProducts();
        showToast('⏳ Menyimpan ke server...', 'info');
        var ok = await saveDataToCloud();
        if (ok) showToast(editIndex >= 0 ? '✅ Produk diupdate!' : '✅ Produk ditambahkan!', 'success');
    };
    
    if (fileInput.files && fileInput.files[0]) {
        showToast('⏳ Kompres foto...', 'info');
        try {
            var compressed = await compressImage(fileInput.files[0], 500, 0.7);
            await saveProduct(compressed);
        } catch(e) {
            showToast('❌ Gagal kompres foto', 'error');
        }
    } else {
        if (editIndex >= 0 && products[editIndex].foto) saveProduct(products[editIndex].foto);
        else saveProduct('');
    }
});

$('btnBatal').addEventListener('click', function() { $('modalProduk').classList.remove('open'); });
$('inputFoto').addEventListener('change', function() { if (this.files && this.files[0]) $('fileText').innerText = this.files[0].name; });

// ============ ADMIN PROMO ============
$('btnKelolaPromo').addEventListener('click', function() {
    if (!isAdmin) return;
    renderPromoList();
    $('modalPromo').classList.add('open');
});

function renderPromoList() {
    var list = $('promoList'); if (!list) return;
    if (promos.length === 0) { list.innerHTML = '<div class="promo-empty">Belum ada promo.</div>'; return; }
    list.innerHTML = promos.map(function(p, idx) {
        var expired = isPromoExpired(p);
        var sisa = hitungHariTersisa(p.expired);
        var badge, info;
        if (expired) {
            badge = '<span class="status-badge expired">EXPIRED</span>';
            info = '<div class="promo-expired-info">Berakhir: ' + formatTanggalPanjang(p.expired) + '</div>';
        } else if (p.expired) {
            badge = sisa <= 3 ? '<span class="status-badge warning">SEGERA HABIS</span>' : '<span class="status-badge active">AKTIF</span>';
            info = '<div class="promo-active-info">Berakhir: ' + formatTanggalPanjang(p.expired) + '<span class="days-left">' + sisa + ' hari lagi</span></div>';
        } else {
            badge = '<span class="status-badge active">AKTIF</span>';
            info = '<div class="promo-active-info">Tanpa kadaluarsa</div>';
        }
        return '<div class="promo-item ' + (expired ? 'expired' : '') + '"><div class="promo-item-header"><span class="promo-item-kode">' + escapeHtml(p.kode) + '</span>' + badge + '</div><div class="promo-item-detail">Diskon <b>' + p.diskon + '%</b></div>' + info + '<div class="promo-item-actions"><button class="btn-edit-promo" onclick="window.editPromo(' + idx + ')">Edit</button><button class="btn-del-promo" onclick="window.deletePromo(' + idx + ')">Hapus</button></div></div>';
    }).join('');
}

window.editPromo = function(index) {
    var p = promos[index]; if (!p) return;
    $('promoKode').value = p.kode; $('promoDiskon').value = p.diskon;
    $('promoExpired').value = p.expired || ''; $('promoEditKode').value = p.kode;
    showToast('✏️ Mode edit', 'info');
};

window.deletePromo = function(index) {
    if (!isAdmin) return;
    showConfirm('Hapus Promo?', 'Kode akan dihapus permanen.', async function() {
        promos.splice(index, 1);
        renderPromoList();
        showToast('⏳ Menyimpan...', 'info');
        var ok = await saveDataToCloud();
        if (ok) showToast('🗑️ Promo dihapus!', 'success');
    });
};

$('btnSimpanPromo').addEventListener('click', async function() {
    if (!isAdmin) return;
    var kode = $('promoKode').value.trim().toUpperCase();
    var diskon = parseInt($('promoDiskon').value);
    var expired = $('promoExpired').value;
    var editKode = $('promoEditKode').value;
    if (!kode || !diskon || diskon < 1 || diskon > 100) { showToast('⚠️ Isi kode & diskon 1-100%!', 'error'); return; }
    var existing = -1;
    for (var i = 0; i < promos.length; i++) if (promos[i].kode.toUpperCase() === kode) { existing = i; break; }
    if (editKode) {
        var idx = -1;
        for (var j = 0; j < promos.length; j++) if (promos[j].kode === editKode) { idx = j; break; }
        if (idx >= 0) {
            if (existing >= 0 && existing !== idx) { showToast('⚠️ Kode sudah dipakai!', 'error'); return; }
            promos[idx] = { kode: kode, diskon: diskon, expired: expired };
        }
    } else {
        if (existing >= 0) { showToast('⚠️ Kode sudah ada!', 'error'); return; }
        promos.push({ kode: kode, diskon: diskon, expired: expired });
    }
    renderPromoList();
    $('promoKode').value = ''; $('promoDiskon').value = ''; $('promoExpired').value = ''; $('promoEditKode').value = '';
    showToast('⏳ Menyimpan...', 'info');
    var ok = await saveDataToCloud();
    if (ok) showToast('✅ Promo tersimpan!', 'success');
});

$('btnTutupPromo').addEventListener('click', function() { $('modalPromo').classList.remove('open'); });

// ============ TESTIMONI ============
var starIcons = document.querySelectorAll('#starsInput i');
starIcons.forEach(function(star) {
    star.addEventListener('click', function() {
        selectedRating = parseInt(this.dataset.star);
        starIcons.forEach(function(s) { s.classList.toggle('active', parseInt(s.dataset.star) <= selectedRating); });
    });
});
starIcons.forEach(function(s) { s.classList.add('active'); });

$('btnKirimTesti').addEventListener('click', async function() {
    var nama = $('testiNama').value.trim();
    var komentar = $('testiKomentar').value.trim();
    if (!nama) { showToast('⚠️ Isi nama!', 'error'); return; }
    if (!komentar) { showToast('⚠️ Tulis komentar!', 'error'); return; }
    testimonials.unshift({ nama: nama, rating: selectedRating, komentar: komentar, tanggal: new Date().toISOString() });
    renderTestimoni();
    $('testiNama').value = ''; $('testiKomentar').value = '';
    selectedRating = 5; starIcons.forEach(function(s) { s.classList.add('active'); });
    showToast('⏳ Mengirim ulasan...', 'info');
    var ok = await saveDataToCloud();
    if (ok) showToast('✅ Terima kasih!', 'success');
});

function renderTestimoni() {
    var list = $('testimoniList'); if (!list) return;
    if (testimonials.length === 0) {
        list.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:30px"><i class="fas fa-comment-dots" style="font-size:2.5rem"></i><h3 style="font-size:1rem">Belum ada ulasan</h3></div>';
        updateStats(); return;
    }
    list.innerHTML = testimonials.map(function(t, idx) {
        var stars = '⭐'.repeat(t.rating);
        var initial = escapeHtml((t.nama || '?').charAt(0).toUpperCase());
        var delBtn = isAdmin ? '<button class="testimoni-del" onclick="window.hapusTestimoni(' + idx + ')"><i class="fas fa-times"></i></button>' : '';
        return '<div class="testimoni-card">' + delBtn + '<div class="testimoni-header"><div class="testimoni-avatar">' + initial + '</div><div><div class="testimoni-nama">' + escapeHtml(t.nama) + '</div><div class="testimoni-stars">' + stars + '</div></div></div><div class="testimoni-text">' + escapeHtml(t.komentar) + '</div><div class="testimoni-date">📅 ' + formatTanggal(t.tanggal) + '</div></div>';
    }).join('');
    updateStats();
}

window.hapusTestimoni = function(index) {
    if (!isAdmin) return;
    showConfirm('Hapus Ulasan?', 'Ulasan akan dihapus permanen.', async function() {
        testimonials.splice(index, 1);
        renderTestimoni();
        showToast('⏳ Menyimpan...', 'info');
        var ok = await saveDataToCloud();
        if (ok) showToast('🗑️ Ulasan dihapus!', 'success');
    });
};

// ============ TAB & SEARCH ============
document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        currentKategori = this.dataset.kategori; currentPage = 1; renderProducts();
    });
});

$('searchInput').addEventListener('input', function() { currentPage = 1; renderProducts(); });

// ============ CONFIRM ============
$('confirmYes').addEventListener('click', function() {
    $('confirmModal').classList.remove('open');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
});

$('confirmNo').addEventListener('click', function() {
    $('confirmModal').classList.remove('open');
    confirmCallback = null;
});

// ============ ADMIN LOGIN ============
$('btnAdminMode').addEventListener('click', function() {
    if (isAdmin) {
        isAdmin = false; renderProducts(); renderTestimoni();
        showToast('🔒 Logout', 'info');
    } else {
        $('passwordOverlay').classList.add('open');
        $('inputPassword').value = ''; $('pwError').innerText = '';
        setTimeout(function() { $('inputPassword').focus(); }, 100);
    }
});

$('btnPwConfirm').addEventListener('click', function() {
    var pw = $('inputPassword').value;
    if (pw === ADMIN_PASSWORD) {
        isAdmin = true;
        $('passwordOverlay').classList.remove('open');
        $('inputPassword').value = '';
        renderProducts(); renderTestimoni();
        showToast('🔓 Admin aktif!', 'success');
    } else {
        $('pwError').innerText = '❌ Password salah!';
    }
});

$('btnPwCancel').addEventListener('click', function() {
    $('passwordOverlay').classList.remove('open');
    $('inputPassword').value = ''; $('pwError').innerText = '';
});

$('inputPassword').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') $('btnPwConfirm').click();
});
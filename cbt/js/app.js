/**
 * cbt/js/app.js
 * E-Learning SMKN 1 CIBINONG — Application Engine v2.0
 * ─────────────────────────────────────────────────────────────────
 * Modules: Auth, Dashboard, Courses, Classes, Schedules, CBT Anti-Cheat Engine,
 *          Rekap Absensi (Bulanan/Semesteran + Chart.js + Export),
 *          User Management, Grades, Theme, Responsive Sidebar, i18n
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN APP OBJECT
══════════════════════════════════════════════════════════════════════════════ */
const App = {
  currentUser: null,
  activeTab:   'dashboard',
  theme:       localStorage.getItem('smkn_theme') || 'light',
  lang:        localStorage.getItem('smkn_lang') || 'id',
  sidebarOpen: false,

  // i18n Dictionary
  i18n: {
    id: {
      dashboard: 'Dashboard', courses: 'Mata Pelajaran', classes: 'Kelas & Rombel',
      schedules: 'Jadwal Kelas', cbt: 'Ujian CBT Online', attendance: 'Input Presensi',
      rekap: 'Rekap Absensi', grades: 'Daftar Nilai', users: 'Manajemen User',
      announcements: 'Pengumuman', course_detail: 'Detail Kursus', logout: 'Keluar',
      // UI strings
      save: 'Simpan', cancel: 'Batal', delete: 'Hapus', edit: 'Edit', add: 'Tambah',
      loading: 'Memuat...', no_data: 'Belum ada data.', confirm_delete: 'Yakin hapus data ini?',
      mark_all_present: 'Tandai Semua Hadir', export_csv: 'Export CSV',
      nilai_tugas: 'Nilai Tugas (30%)', nilai_uts: 'Nilai UTS (20%)',
      nilai_uas: 'Nilai UAS/CBT (30%)', nilai_hadir: 'Nilai Kehadiran (20%)',
      nilai_akhir: 'Nilai Akhir', predikat: 'Predikat',
      materials: 'Materi', assignments: 'Tugas', discussions: 'Diskusi', presensi: 'Presensi'
    },
    en: {
      dashboard: 'Dashboard', courses: 'Courses', classes: 'Classes',
      schedules: 'Schedules', cbt: 'Online CBT Exams', attendance: 'Input Attendance',
      rekap: 'Attendance Recap', grades: 'Grades', users: 'User Management',
      announcements: 'Announcements', course_detail: 'Course Detail', logout: 'Logout',
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add',
      loading: 'Loading...', no_data: 'No data yet.', confirm_delete: 'Confirm delete?',
      mark_all_present: 'Mark All Present', export_csv: 'Export CSV',
      nilai_tugas: 'Assignment Grade (30%)', nilai_uts: 'Midterm (20%)',
      nilai_uas: 'Final/CBT (30%)', nilai_hadir: 'Attendance Grade (20%)',
      nilai_akhir: 'Final Grade', predikat: 'Predicate',
      materials: 'Materials', assignments: 'Assignments', discussions: 'Discussions', presensi: 'Attendance'
    }
  },
  t(key) { return this.i18n[this.lang]?.[key] ?? key; },

  toggleLang() {
    this.lang = this.lang === 'id' ? 'en' : 'id';
    localStorage.setItem('smkn_lang', this.lang);
    const el = document.getElementById('lang-text');
    if (el) el.textContent = this.lang.toUpperCase();
    if (this.currentUser) {
      this.renderAppLayout(this.activeTab);
      this.renderNavbarUser();
    }
  },
  sidebarOpen: false,

  // Exam state
  currentQuiz:          null,
  questions:            [],
  currentQuestionIndex: 0,
  savedAnswers:         {},
  flaggedQuestions:     {},
  attemptId:            null,
  timerInterval:        null,
  timeRemaining:        0,

  // Chart instances (to destroy before re-render)
  _chartTrend:  null,
  _chartDonut:  null,

  // Rekap state
  rekapMode:        'monthly',
  rekapClassId:     0,
  rekapMonth:       new Date().getMonth() + 1,
  rekapYear:        new Date().getFullYear(),
  rekapSemester:    1,

  /* ────────────────────────────────────────────────────────────────────────────
     INIT
  ──────────────────────────────────────────────────────────────────────────── */
  init() {
    this.applyTheme(this.theme);
    this.startClock();
    this.checkAuth();
  },

  /* ────────────────────────────────────────────────────────────────────────────
     CLOCK
  ──────────────────────────────────────────────────────────────────────────── */
  startClock() {
    const tick = () => {
      const el = document.getElementById('nav-clock-display');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    tick();
    setInterval(tick, 1000);
  },

  /* ────────────────────────────────────────────────────────────────────────────
     THEME
  ──────────────────────────────────────────────────────────────────────────── */
  applyTheme(t) {
    this.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('smkn_theme', t);
    const btn = document.getElementById('theme-btn');
    if (btn) btn.querySelector('#theme-icon').textContent = t === 'dark' ? '🌙' : '☀️';
    // Update chart colors if charts exist
    if (this._chartTrend) this._applyChartTheme(this._chartTrend);
    if (this._chartDonut) this._applyChartTheme(this._chartDonut);
  },

  toggleTheme() {
    this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
  },

  _applyChartTheme(chart) {
    const textColor = this.theme === 'dark' ? '#94a8c0' : '#3d5a7a';
    if (chart.options.scales) {
      ['x','y'].forEach(axis => {
        if (chart.options.scales[axis]) {
          chart.options.scales[axis].ticks.color = textColor;
          chart.options.scales[axis].grid.color = this.theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        }
      });
    }
    chart.update();
  },

  /* ────────────────────────────────────────────────────────────────────────────
     SIDEBAR (Mobile responsive)
  ──────────────────────────────────────────────────────────────────────────── */
  toggleSidebar() {
    this.sidebarOpen ? this.closeSidebar() : this.openSidebar();
  },

  openSidebar() {
    this.sidebarOpen = true;
    document.getElementById('main-sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('open');
    document.getElementById('hamburger-btn')?.classList.add('open');
  },

  closeSidebar() {
    this.sidebarOpen = false;
    document.getElementById('main-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
    document.getElementById('hamburger-btn')?.classList.remove('open');
  },

  /* ────────────────────────────────────────────────────────────────────────────
     AUTH
  ──────────────────────────────────────────────────────────────────────────── */
  checkAuth() {
    fetch('api/auth.php?action=status')
      .then(r => r.json())
      .then(data => {
        if (data.logged_in) {
          this.currentUser = data.user;
          this.renderNavbarUser();
          document.getElementById('app-layout').style.display = '';
          this.renderAppLayout(this.activeTab);
        } else {
          this.showLoginView();
        }
      })
      .catch(() => this.showLoginView());
  },

  showLoginView() {
    // Hide sidebar on login
    document.getElementById('app-layout').classList.add('login-mode');
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar) sidebar.style.display = 'none';

    // Generate captcha
    const captchaVal = this._genCaptcha();

    document.getElementById('main-content').innerHTML = `
      <!-- ══ MOBILE THIN BANNER (shown on < 1024px) ══ -->
      <div class="login-mobile-banner">
        <div class="login-mobile-banner-inner">
          <img src="images/logo.png" alt="Logo SMKN 1 CIBINONG" class="login-mobile-banner-img" onerror="this.onerror=null; this.src='images/logo.jpg';">
          <div class="login-mobile-banner-text">
            <strong>E-Learning SMKN 1 CIBINONG</strong>
            <span>Portal Pembelajaran Digital Terintegrasi</span>
          </div>
        </div>
      </div>

      <!-- ══ SPLIT-SCREEN WRAPPER ══ -->
      <div class="login-split-wrapper">

        <!-- ════ LEFT SIDE: VISUAL BANNER ════ -->
        <div class="login-banner-side">
          <img class="login-banner-img"
               src="images/login-hero.jpg"
               alt="Siswa-siswi SMKN 1 CIBINONG belajar di kelas modern"
               onerror="this.onerror=null; this.src='images/login-banner.jpg';">
          <div class="login-banner-overlay"></div>
          <div class="login-banner-content">
            <!-- Logo Row -->
            <div class="login-banner-logo-row">
              <img src="images/logo.png" alt="Logo SMKN 1 CIBINONG" class="login-banner-logo-img" onerror="this.onerror=null; this.src='images/logo.jpg';">
              <span class="login-banner-logo-label">SMKN 1 CIBINONG</span>
            </div>

            <!-- Headline -->
            <div class="login-banner-headline">
              Selamat Datang di<br>
              <span>E-Learning</span><br>
              SMKN 1 CIBINONG
            </div>

            <!-- Sub-headline -->
            <div class="login-banner-sub">
              Portal Pembelajaran Digital Terintegrasi &amp; Berprestasi untuk seluruh warga SMKN 1 CIBINONG.
            </div>

            <!-- Badge Tagline -->
            <div class="login-banner-badge">
              Unggul, Berkarakter, Siap Kerja
            </div>

            <!-- Stats Row -->
            <div class="login-banner-stats">
              <div class="banner-stat">
                <span class="banner-stat-num">2.400+</span>
                <span class="banner-stat-label">Siswa Aktif</span>
              </div>
              <div class="banner-stat">
                <span class="banner-stat-num">120+</span>
                <span class="banner-stat-label">Tenaga Didik</span>
              </div>
              <div class="banner-stat">
                <span class="banner-stat-num">18+</span>
                <span class="banner-stat-label">Program Keahlian</span>
              </div>
            </div>
          </div>
        </div>
        <!-- ════ END LEFT SIDE ════ -->

        <!-- ════ RIGHT SIDE: FORM LOGIN ════ -->
        <div class="login-form-side" id="login-form-side">

          <!-- Language Switcher -->
          <div class="login-lang-switcher" id="login-lang-switcher" onclick="App.toggleLoginLang()">
            <span class="lang-opt ${this.lang === 'id' ? 'active' : ''}" id="ls-id">ID</span>
            <span class="lang-sep">|</span>
            <span class="lang-opt ${this.lang === 'en' ? 'active' : ''}" id="ls-en">EN</span>
          </div>

          <div class="login-form-card">

            <!-- Logo & Header -->
            <div class="login-logo">
              <img src="images/logo.png" alt="Logo SMKN 1 CIBINONG" class="login-form-logo-img" onerror="this.onerror=null; this.src='images/logo.jpg';">
              <span class="login-school-name">E-Learning SMKN 1 CIBINONG</span>
              <span class="login-welcome-text">Silakan Masuk ke Akun Anda</span>
              <span class="login-tagline">E-Learning &amp; CBT Online · Portal Akademik Terpadu</span>
              <br>
              <span class="ssl-badge">🔒 Secure Connection SSL/TLS</span>
            </div>

            <!-- Error Banner -->
            <div class="login-error" id="login-error"></div>

            <!-- Form -->
            <form class="login-form" onsubmit="App.handleLogin(event)" id="login-form-el" autocomplete="on">

              <!-- Role Selector -->
              <div class="form-group">
                <label class="form-label">Masuk Sebagai</label>
                <div class="role-grid">
                  <button type="button" class="role-btn active" id="role-siswa" onclick="App.setRole('siswa')">
                    <span class="role-icon">🎓</span>
                    <span>Siswa</span>
                  </button>
                  <button type="button" class="role-btn" id="role-guru" onclick="App.setRole('guru')">
                    <span class="role-icon">👨‍🏫</span>
                    <span>Guru</span>
                  </button>
                  <button type="button" class="role-btn" id="role-admin" onclick="App.setRole('admin')">
                    <span class="role-icon">🛡️</span>
                    <span>Admin</span>
                  </button>
                </div>
              </div>

              <!-- Username / NISN / NIP -->
              <div class="form-group">
                <label class="form-label" for="login-user" id="login-user-label">NISN / Username Siswa</label>
                <div class="input-with-icon">
                  <span class="input-icon">👤</span>
                  <input type="text" id="login-user" class="form-control" placeholder="Masukkan NISN atau username" required autocomplete="username">
                </div>
              </div>

              <!-- Password + Eye Toggle -->
              <div class="form-group">
                <label class="form-label" for="login-pass">Password</label>
                <div class="input-with-icon">
                  <span class="input-icon">🔒</span>
                  <input type="password" id="login-pass" class="form-control with-toggle" placeholder="Masukkan password" required autocomplete="current-password">
                  <button type="button" class="eye-toggle" id="eye-toggle-btn" onclick="App.togglePasswordVisibility()" title="Lihat/Sembunyikan Password">
                    <span id="eye-icon">👁️</span>
                  </button>
                </div>
              </div>

              <!-- Remember Me + Forgot Password -->
              <div class="remember-row">
                <label class="remember-label" for="remember-me">
                  <input type="checkbox" id="remember-me" name="remember_me">
                  Ingat Saya
                </label>
                <a href="#" class="forgot-link" id="forgot-pw-link" onclick="App.showForgotPassword(event)">
                  Lupa Password?
                </a>
              </div>

              <!-- Captcha -->
              <div class="form-group">
                <label class="form-label">Verifikasi Keamanan <span style="font-weight:400;color:var(--text-muted)">(klik untuk ganti)</span></label>
                <div class="captcha-row">
                  <div class="captcha-box" id="captcha-box" onclick="App.refreshCaptcha()" title="Klik untuk ganti kode">${captchaVal}</div>
                  <input type="text" id="captcha-input" class="form-control captcha-input" placeholder="Ketik kode di atas" required autocomplete="off" maxlength="6">
                </div>
              </div>

              <!-- Login Button -->
              <button type="submit" class="btn-login" id="login-btn">
                🔐 Masuk / Login
              </button>
            </form>

            <!-- Demo Quick Login -->
            <div class="demo-login-section">
              <div class="demo-label">— Akses Demo Cepat (Testing) —</div>
              <div class="demo-btns">
                <button class="demo-btn" onclick="App.quickLogin('admin','password123')">🛡️ Admin</button>
                <button class="demo-btn" onclick="App.quickLogin('guru1','password123')">👨‍🏫 Bpk. Andi (Guru)</button>
                <button class="demo-btn" onclick="App.quickLogin('siswa1','password123')">🎓 Ahmad (Siswa)</button>
                <button class="demo-btn" onclick="App.quickLogin('siswa2','password123')">🎓 Bunga (Siswa)</button>
              </div>
            </div>

            <!-- Footer -->
            <div class="login-footer">
              © 2026 E-Learning SMKN 1 CIBINONG. All Rights Reserved.<br>
              Jl. Karadenan No.1, Cibinong, Kab. Bogor 16913
            </div>
          </div>
        </div>
        <!-- ════ END RIGHT SIDE ════ -->

      </div><!-- /.login-split-wrapper -->
    `;

    // Store captcha value
    this._captcha = captchaVal;
  },

  togglePasswordVisibility() {
    const passInput = document.getElementById('login-pass');
    const eyeIcon   = document.getElementById('eye-icon');
    if (!passInput) return;
    if (passInput.type === 'password') {
      passInput.type = 'text';
      if (eyeIcon) eyeIcon.textContent = '🙈';
    } else {
      passInput.type = 'password';
      if (eyeIcon) eyeIcon.textContent = '👁️';
    }
  },

  toggleLoginLang() {
    this.lang = this.lang === 'id' ? 'en' : 'id';
    localStorage.setItem('smkn_lang', this.lang);
    const el = document.getElementById('lang-text');
    if (el) el.textContent = this.lang.toUpperCase();
    // Update switcher UI
    document.getElementById('ls-id')?.classList.toggle('active', this.lang === 'id');
    document.getElementById('ls-en')?.classList.toggle('active', this.lang === 'en');
  },

  showForgotPassword(e) {
    e.preventDefault();
    alert('Silakan hubungi Administrator SMKN 1 CIBINONG untuk reset password.\nEmail: admin@smkn1cibinong.sch.id');
  },



  _captcha: '',
  _selectedRole: 'siswa',

  _genCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  },

  refreshCaptcha() {
    const val = this._genCaptcha();
    this._captcha = val;
    const el = document.getElementById('captcha-box');
    if (el) el.textContent = val;
    const inp = document.getElementById('captcha-input');
    if (inp) inp.value = '';
  },

  setRole(role) {
    this._selectedRole = role;
    ['siswa','guru','admin'].forEach(r => {
      document.getElementById(`role-${r}`)?.classList.toggle('active', r === role);
    });
    const labels = { siswa: 'NISN / Username Siswa', guru: 'NIP / Username Guru', admin: 'Username Administrator' };
    const ph = { siswa: 'Masukkan NISN atau username', guru: 'Masukkan NIP atau username', admin: 'Masukkan username admin' };
    const lbl = document.getElementById('login-user-label');
    const inp = document.getElementById('login-user');
    if (lbl) lbl.textContent = labels[role];
    if (inp) inp.placeholder = ph[role];
  },

  handleLogin(e) {
    e.preventDefault();
    const captchaInput = document.getElementById('captcha-input')?.value?.trim().toUpperCase();
    if (captchaInput !== this._captcha) {
      this._showLoginError('Kode verifikasi salah. Silakan coba lagi.');
      this.refreshCaptcha();
      return;
    }

    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;

    if (!username || !password) {
      this._showLoginError('Username dan password wajib diisi.');
      return;
    }

    const btn = document.getElementById('login-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
    this._hideLoginError();

    fetch('api/auth.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          this.currentUser = data.user;
          document.getElementById('app-layout').classList.remove('login-mode');
          document.getElementById('main-sidebar').style.display = '';
          this.renderNavbarUser();
          this.renderAppLayout('dashboard');
        } else {
          this._showLoginError(data.message || 'Login gagal. Periksa kembali data Anda.');
          this.refreshCaptcha();
          if (btn) { btn.disabled = false; btn.textContent = '🔐 Masuk ke Portal Akademik'; }
        }
      })
      .catch(() => {
        this._showLoginError('Koneksi bermasalah. Pastikan server berjalan.');
        if (btn) { btn.disabled = false; btn.textContent = '🔐 Masuk ke Portal Akademik'; }
      });
  },

  quickLogin(username, password) {
    this._hideLoginError();
    fetch('api/auth.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          this.currentUser = data.user;
          document.getElementById('app-layout').classList.remove('login-mode');
          document.getElementById('main-sidebar').style.display = '';
          this.renderNavbarUser();
          this.renderAppLayout('dashboard');
        } else {
          this._showLoginError(data.message);
        }
      });
  },

  _showLoginError(msg) {
    const el = document.getElementById('login-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  },
  _hideLoginError() {
    const el = document.getElementById('login-error');
    if (el) el.style.display = 'none';
  },

  logout() {
    fetch('api/auth.php?action=logout')
      .then(() => {
        this.currentUser = null;
        this.activeTab = 'dashboard';
        this.closeSidebar();
        this.showLoginView();
        // Reset navbar user
        const ua = document.getElementById('navbar-user-area');
        if (ua) ua.innerHTML = '';
      });
  },

  /* ────────────────────────────────────────────────────────────────────────────
     NAVBAR USER
  ──────────────────────────────────────────────────────────────────────────── */
  renderNavbarUser() {
    const u = this.currentUser;
    if (!u) return;
    const initials = u.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const roleLabel = { admin: 'Administrator', guru: 'Guru', siswa: 'Siswa' };
    const ua = document.getElementById('navbar-user-area');
    if (!ua) return;
    ua.innerHTML = `
      <div class="nav-avatar" title="Klik untuk edit profil" style="cursor:pointer;" onclick="App.openProfileModal()">${initials}</div>
      <div class="nav-user-info" style="cursor:pointer;" onclick="App.openProfileModal()" title="Klik untuk edit profil">
        <span class="nav-user-name">${this.escHtml(u.name)} ⚙️</span>
        <span class="nav-user-role">${roleLabel[u.role] || u.role}</span>
      </div>
      <button class="nav-logout-btn" onclick="App.logout()">${this.t('logout')}</button>
    `;
  },

  openProfileModal() {
    const u = this.currentUser;
    fetch(`api/users.php?id=${u.id}`)
      .then(r => r.json())
      .then(d => {
        const user = d.user || u;
        const isGuru = user.role === 'guru';
        const isAdmin = user.role === 'admin';

        this.openModal('Profil & Pengaturan Akun', `
          <form onsubmit="App.handleUpdateProfile(event)">
            <div class="form-group mb-2">
              <label class="form-label">Nama Lengkap</label>
              <input type="text" id="prof-name" class="form-control" value="${this.escHtml(user.name)}" required>
            </div>
            <div class="grid-2col mb-2" style="gap:0.75rem;">
              <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" class="form-control" value="${this.escHtml(user.username)}" disabled style="opacity:0.7;">
              </div>
              <div class="form-group">
                <label class="form-label">NIP / NIS</label>
                <input type="text" id="prof-nip" class="form-control" value="${this.escHtml(user.nip_nis || '')}">
              </div>
            </div>
            <div class="form-group mb-2">
              <label class="form-label">Jurusan / Program Keahlian</label>
              <select id="prof-major" class="form-control">
                <option value="Umum" ${user.major === 'Umum' ? 'selected' : ''}>Umum</option>
                <option value="RPL" ${user.major === 'RPL' ? 'selected' : ''}>RPL (Rekayasa Perangkat Lunak)</option>
                <option value="SIJA" ${user.major === 'SIJA' ? 'selected' : ''}>SIJA (Sistem Informatika Jaringan & Aplikasi)</option>
                <option value="TKJ" ${user.major === 'TKJ' ? 'selected' : ''}>TKJ (Teknik Komputer & Jaringan)</option>
              </select>
            </div>
            ${isGuru || isAdmin ? `
              <div class="form-group mb-2">
                <label class="form-label">Mata Pelajaran yang Diampu</label>
                <input type="text" id="prof-subj" class="form-control" placeholder="cth: Pemrograman Web, Basis Data" value="${this.escHtml(user.subjects || '')}">
              </div>
              <div class="form-group mb-2">
                <label class="form-label">Kelas yang Diajar</label>
                <input type="text" id="prof-classes" class="form-control" placeholder="cth: XII RPL 1, XII SIJA 1" value="${this.escHtml(user.classes_taught || '')}">
              </div>
            ` : ''}
            <div class="form-group mb-3">
              <label class="form-label">Ganti Password (Kosongkan jika tidak ingin mengubah)</label>
              <input type="password" id="prof-pass" class="form-control" placeholder="Password baru…">
            </div>
            <div class="flex-end flex-gap-1">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan Profil</button>
            </div>
          </form>
        `);
      });
  },

  handleUpdateProfile(e) {
    e.preventDefault();
    const body = {
      action: 'update_profile',
      name: document.getElementById('prof-name').value,
      nip_nis: document.getElementById('prof-nip') ? document.getElementById('prof-nip').value : '',
      major: document.getElementById('prof-major') ? document.getElementById('prof-major').value : 'Umum',
      subjects: document.getElementById('prof-subj') ? document.getElementById('prof-subj').value : '',
      classes_taught: document.getElementById('prof-classes') ? document.getElementById('prof-classes').value : '',
      password: document.getElementById('prof-pass') ? document.getElementById('prof-pass').value : ''
    };

    fetch('api/users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json()).then(res => {
      if (res.success) {
        this.currentUser.name = body.name;
        this.renderNavbarUser();
        this.closeModal();
        this._toast('✅ Profil berhasil diperbarui.');
      } else alert(res.message);
    });
  },


  /* ────────────────────────────────────────────────────────────────────────────
     APP LAYOUT (Sidebar + Content)
  ──────────────────────────────────────────────────────────────────────────── */
  renderAppLayout(tab) {
    this.activeTab = tab;
    this.closeSidebar();

    const u = this.currentUser;
    const isAdmin   = u.role === 'admin';
    const isGuru    = u.role === 'guru';
    const isStaff   = isAdmin || isGuru;
    const isSiswa   = u.role === 'siswa';

    // Build sidebar nav (Clean Text-Only Menu as requested)
    const navItems = [
      { tab: 'dashboard',     label: this.t('dashboard'),     section: 'Akademik' },
      { tab: 'courses',       label: this.t('courses'),       section: null },
      { tab: 'classes',       label: this.t('classes'),       section: null },
      { tab: 'schedules',     label: this.t('schedules'),     section: null },
      { tab: 'cbt',           label: this.t('cbt'),           section: 'Evaluasi & Penilaian' },
      { tab: 'grades',        label: this.t('grades'),        section: null },
      { tab: 'attendance',    label: this.t('attendance'),    section: 'Presensi',    staffOnly: true },
      { tab: 'rekap',         label: this.t('rekap'),         section: null },
      { tab: 'announcements', label: this.t('announcements'), section: 'Komunikasi',  staffOnly: false },
      ...(isStaff ? [
        { tab: 'users', label: this.t('users'), section: 'Administrasi' }
      ] : [])
    ];

    let lastSection = '';
    let navHtml = '';
    navItems.forEach(item => {
      if (item.staffOnly && !isStaff) return;
      if (item.section && item.section !== lastSection) {
        if (lastSection) navHtml += `<div class="sidebar-divider"></div>`;
        navHtml += `<div class="sidebar-section-label">${item.section}</div>`;
        lastSection = item.section;
      }
      navHtml += `
        <a class="nav-link ${this.activeTab === item.tab ? 'active' : ''}"
           onclick="App.renderAppLayout('${item.tab}')">
          <span class="nav-link-text">${item.label}</span>
        </a>
      `;
    });

    document.getElementById('sidebar-nav-content').innerHTML = navHtml;

    // Load view
    const views = {
      dashboard:     () => this.loadDashboard(),
      courses:       () => this.loadCourses(),
      classes:       () => this.loadClasses(),
      schedules:     () => this.loadSchedules(),
      cbt:           () => this.loadCbt(),
      attendance:    () => this.loadAttendanceInput(),
      rekap:         () => this.loadRekapAbsensi(),
      grades:        () => this.loadGradesModule(),
      announcements: () => this.loadAnnouncements(),
      users:         () => this.loadUsers(),
    };

    const mc = document.getElementById('main-content');
    mc.innerHTML = `<div class="boot-screen"><div class="boot-shield">
      <div class="boot-text">Memuat data…</div>
      <div class="boot-bar"><div class="boot-bar-fill"></div></div>
    </div></div>`;

    (views[tab] || views.dashboard)();
  },

  setContent(html) {
    document.getElementById('main-content').innerHTML = html;
  },

  /* ────────────────────────────────────────────────────────────────────────────
     DASHBOARD
  ──────────────────────────────────────────────────────────────────────────── */
  loadDashboard() {
    fetch('api/dashboard.php')
      .then(r => r.json())
      .then(data => {
        const s = data.stats || {};
        const u = this.currentUser;
        const isStaff = u.role !== 'siswa';
        const roleEmoji = { admin: '🛡️', guru: '👨‍🏫', siswa: '🎓' };

        const recentQuizzes = (data.recent_quizzes || []).slice(0, 3);
        const quizHtml = recentQuizzes.length ? recentQuizzes.map(q => `
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border-subtle);">
            <div style="width:36px;height:36px;border-radius:var(--r-md);background:var(--cyan-dim);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">📝</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.88rem;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escHtml(q.title)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Oleh: ${this.escHtml(q.teacher_name || '—')} · ${q.duration_minutes} menit</div>
            </div>
            <span class="badge badge-cyan">${q.status}</span>
          </div>
        `).join('') : `<div class="empty-state"><div class="empty-icon">📝</div><p>Belum ada ujian terbaru.</p></div>`;

        // Student attendance summary
        const ss = data.student_stats;
        const studentAttHtml = (u.role === 'siswa' && ss) ? `
          <div class="card mb-3">
            <div class="card-title">📋 Rekap Presensi Saya</div>
            <div class="stats-grid" style="margin-bottom:0;">
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--emerald-dim);font-size:1.3rem;">✅</div>
                <div><div class="stat-value text-green">${ss.attendance_summary?.hadir || 0}</div><div class="stat-label">Hadir</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--blue-dim);font-size:1.3rem;">📄</div>
                <div><div class="stat-value" style="color:var(--blue);">${ss.attendance_summary?.izin || 0}</div><div class="stat-label">Izin</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--amber-dim);font-size:1.3rem;">🤒</div>
                <div><div class="stat-value text-amber">${ss.attendance_summary?.sakit || 0}</div><div class="stat-label">Sakit</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--danger-dim);font-size:1.3rem;">❌</div>
                <div><div class="stat-value text-danger">${ss.attendance_summary?.alpa || 0}</div><div class="stat-label">Alpa</div></div>
              </div>
            </div>
          </div>
        ` : '';

        this.setContent(`
          <!-- Hero Banner -->
          <div class="hero-banner">
            <div>
              <div class="hero-badge">${roleEmoji[u.role]} Tahun Ajaran 2026/2027 · SMKN 1 CIBINONG</div>
              <div class="hero-title">Selamat Datang, <span>${this.escHtml(u.name.split(' ')[0])}!</span> 👋</div>
              <div class="hero-sub">
                Portal E-Learning & CBT Online SMKN 1 CIBINONG. Akses materi, ujian, presensi, dan nilai akademik dalam satu platform terintegrasi.
              </div>
            </div>
            <div class="hero-logo-box">
              <img src="images/logo.png" alt="Logo SMKN 1 CIBINONG" class="hero-logo-img" onerror="this.onerror=null; this.src='images/logo.jpg';">
            </div>
          </div>

          <!-- Stats Grid -->
          <div class="stats-grid">
            ${isStaff ? `
              <div class="stat-card">
                <div class="stat-icon-box">📚</div>
                <div><div class="stat-value">${s.total_courses || 0}</div><div class="stat-label">Mata Pelajaran</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:rgba(99,102,241,0.15);font-size:1.3rem;">🏛️</div>
                <div><div class="stat-value">${s.total_classes || 0}</div><div class="stat-label">Kelas / Rombel</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--emerald-dim);font-size:1.3rem;">🎓</div>
                <div><div class="stat-value text-green">${s.total_students || 0}</div><div class="stat-label">Siswa Aktif</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--amber-dim);font-size:1.3rem;">📝</div>
                <div><div class="stat-value text-amber">${s.total_quizzes || 0}</div><div class="stat-label">Ujian CBT Aktif</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--cyan-dim);font-size:1.3rem;">✅</div>
                <div><div class="stat-value text-cyan">${s.today_attendance || 0}</div><div class="stat-label">Hadir Hari Ini</div></div>
              </div>
            ` : `
              <div class="stat-card">
                <div class="stat-icon-box">📝</div>
                <div><div class="stat-value">${ss?.completed_exams || 0}</div><div class="stat-label">Ujian Selesai</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--emerald-dim);">✅</div>
                <div><div class="stat-value text-green">${ss?.attendance_summary?.hadir || 0}</div><div class="stat-label">Total Hadir</div></div>
              </div>
              <div class="stat-card">
                <div class="stat-icon-box" style="background:var(--danger-dim);">❌</div>
                <div><div class="stat-value text-danger">${ss?.attendance_summary?.alpa || 0}</div><div class="stat-label">Alpa</div></div>
              </div>
            `}
          </div>

          ${studentAttHtml}

          <!-- 2-col: Announcements + Quick Links -->
          <div class="grid-2col">
            <div class="card">
              <div class="card-title">📢 ${this.t('announcements')}
                ${isStaff ? `<button class="btn btn-outline" style="margin-left:auto;font-size:0.78rem;padding:0.3rem 0.7rem;" onclick="App.renderAppLayout('announcements')">Kelola ›</button>` : ''}
              </div>
              <div class="glow-line"></div>
              <div id="dash-announcements"><div style="color:var(--text-muted);font-size:0.85rem;">Memuat pengumuman…</div></div>
            </div>

            <div class="card">
              <div class="card-title">⚡ Menu Pintas</div>
              <div style="display:flex;flex-direction:column;gap:0.6rem;">
                <button class="btn btn-primary btn-full" onclick="App.renderAppLayout('cbt')">📝 Buka Menu Ujian CBT</button>
                <button class="btn btn-outline btn-full"  onclick="App.renderAppLayout('rekap')">📊 Rekap Absensi Siswa</button>
                <button class="btn btn-outline btn-full" onclick="App.renderAppLayout('grades')">🏆 Lihat Daftar Nilai</button>
                ${isStaff ? `<button class="btn btn-primary btn-full" onclick="App.renderAppLayout('attendance')">📋 Input Presensi Hari Ini</button>` : ''}
              </div>
              <div class="glow-line" style="margin:1.25rem 0 1rem;"></div>
              <div class="card-title" style="font-size:0.9rem;">📝 Ujian Terbaru</div>
              ${quizHtml}
            </div>
          </div>
        `);

        // Load announcements dynamically
        fetch('api/announcements.php')
          .then(r => r.json())
          .then(ann => {
            const el = document.getElementById('dash-announcements');
            if (!el) return;
            const items = ann.data || ann.announcements || [];
            if (!items.length) { el.innerHTML = `<div class="empty-state" style="padding:1rem 0;"><div class="empty-icon">📢</div><p>Belum ada pengumuman.</p></div>`; return; }
            el.innerHTML = items.slice(0,4).map(a => `
              <div style="background:var(--bg-card2);border:1px solid var(--border-subtle);border-radius:var(--r-md);padding:1rem;margin-bottom:0.75rem;">
                <div class="flex-between mb-1">
                  <span style="font-weight:700;color:var(--accent);font-size:0.88rem;">${a.is_pinned ? '📌 ' : ''}${this.escHtml(a.title)}</span>
                  <span class="badge badge-${a.target === 'siswa' ? 'cyan' : a.target === 'guru' ? 'amber' : 'blue'}" style="font-size:0.65rem;">${a.target === 'all' ? 'Semua' : a.target}</span>
                </div>
                <p style="font-size:0.82rem;color:var(--text-sub);line-height:1.55;margin:0;">${this.escHtml(a.content).substring(0,180)}${a.content.length > 180 ? '…' : ''}</p>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.4rem;">${this.escHtml(a.author_name)} · ${new Date(a.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</div>
              </div>
            `).join('');
          })
          .catch(() => { const el = document.getElementById('dash-announcements'); if(el) el.innerHTML = ''; });
      });
  },

  /* ────────────────────────────────────────────────────────────────────────────
     COURSES
  ──────────────────────────────────────────────────────────────────────────── */
  _courseFilterMajor: 'all',

  loadCourses(filterMajor) {
    if (filterMajor !== undefined) this._courseFilterMajor = filterMajor;
    const major = this._courseFilterMajor;
    const url = major !== 'all' ? `api/courses.php?major=${encodeURIComponent(major)}` : 'api/courses.php';

    fetch(url)
      .then(r => r.json())
      .then(data => {
        const courses = data.courses || [];
        const isStaff = this.currentUser.role !== 'siswa';

        const courseCards = courses.length ? courses.map(c => `
          <div class="quiz-card">
            <div>
              <div class="flex-between mb-2">
                <span style="font-size:2rem;">${c.icon || '📚'}</span>
                <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                  <span class="badge badge-cyan">${this.escHtml(c.course_code)}</span>
                  ${c.major ? `<span class="badge badge-amber">${this.escHtml(c.major)}</span>` : ''}
                </div>
              </div>
              <div class="quiz-card-title">${this.escHtml(c.course_name)}</div>
              <div class="quiz-card-desc">
                🏛️ Kelas: <b>${this.escHtml(c.class_name || 'Semua Kelas')}</b><br>
                👨‍🏫 Pengampu: <b>${this.escHtml(c.teacher_name || 'Belum ditugaskan')}</b><br>
                📁 <b>${c.material_count || 0}</b> Materi &bull; 📝 <b>${c.assignment_count || 0}</b> Tugas &bull; 🎯 <b>${c.quiz_count || 0}</b> Ujian
              </div>
            </div>
            <div class="quiz-card-actions">
              <button class="btn btn-primary btn-full" onclick="App.openCourseDetail(${c.id})">📖 Masuk Kelas & Materi</button>
              <div class="flex-gap-1 mt-1">
                <button class="btn btn-outline" style="flex:1;" onclick="App.renderAppLayout('cbt')">📝 CBT (${c.quiz_count || 0})</button>
                ${isStaff ? `<button class="btn btn-danger btn-sm" onclick="App.deleteCourse(${c.id})">🗑️</button>` : ''}
              </div>
            </div>
          </div>
        `).join('') : `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📚</div><p>Belum ada mata pelajaran terdaftar untuk jurusan ini.</p></div>`;

        this.setContent(`
          <div class="flex-between mb-3">
            <div>
              <div class="section-title">📚 Mata Pelajaran</div>
              <div class="section-sub">Daftar mata pelajaran yang tersedia di SMKN 1 CIBINONG.</div>
            </div>
            ${isStaff ? `<button class="btn btn-primary" onclick="App.openAddCourseModal()">➕ Tambah Mapel</button>` : ''}
          </div>
          <div class="filter-bar mb-3" style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            ${['all', 'RPL', 'SIJA', 'TKJ', 'Umum'].map(m => `
              <button class="btn btn-sm ${major === m ? 'btn-primary' : 'btn-secondary'}" 
                onclick="App.loadCourses('${m}')">
                ${m === 'all' ? '🌐 Semua Jurusan' : '🎯 Jurusan ' + m}
              </button>
            `).join('')}
          </div>
          <div class="cards-grid">${courseCards}</div>
        `);
      });
  },

  openAddCourseModal() {
    fetch('api/classes.php')
      .then(r => r.json())
      .then(d => {
        const classes = d.classes || [];
        const opts = `<option value="">- Semua Kelas (Umum) -</option>` + classes.map(cl => `<option value="${cl.id}">${this.escHtml(cl.class_name)}</option>`).join('');
        this.openModal('Tambah Mata Pelajaran Baru', `
          <form onsubmit="App.handleAddCourse(event)">
            <div class="form-group mb-2"><label class="form-label">Kode Mapel</label><input type="text" id="c-code" class="form-control" placeholder="cth: RPL-PWB" required></div>
            <div class="form-group mb-2"><label class="form-label">Nama Mata Pelajaran</label><input type="text" id="c-name" class="form-control" placeholder="cth: Pemrograman Web & Basis Data" required></div>
            <div class="form-group mb-2"><label class="form-label">Jurusan</label>
              <select id="c-major" class="form-control">
                <option value="Umum">Umum (Semua Jurusan)</option>
                <option value="RPL">RPL (Rekayasa Perangkat Lunak)</option>
                <option value="SIJA">SIJA (Sistem Informatika Jaringan & Aplikasi)</option>
                <option value="TKJ">TKJ (Teknik Komputer & Jaringan)</option>
              </select>
            </div>
            <div class="form-group mb-2"><label class="form-label">Kelas</label><select id="c-class" class="form-control">${opts}</select></div>
            <div class="form-group mb-3"><label class="form-label">Ikon (Emoji)</label><input type="text" id="c-icon" class="form-control" value="📚" maxlength="8"></div>
            <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
          </form>
        `);
      });
  },

  handleAddCourse(e) {
    e.preventDefault();
    fetch('api/courses.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        course_code: document.getElementById('c-code').value,
        course_name: document.getElementById('c-name').value,
        major: document.getElementById('c-major').value,
        class_id: document.getElementById('c-class').value,
        icon: document.getElementById('c-icon').value
      })
    }).then(r => r.json()).then(d => { if (d.success) { this.closeModal(); this.loadCourses(); } else alert(d.message); });
  },

  deleteCourse(id) {
    if (!confirm('Hapus mata pelajaran ini?')) return;
    fetch('api/courses.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', course_id: id }) }).then(() => this.loadCourses());
  },

  /* ────────────────────────────────────────────────────────────────────────────
     COURSE DETAIL PAGE (4 Tabs: Materi, Tugas, Diskusi, Informasi)
  ──────────────────────────────────────────────────────────────────────────── */
  openCourseDetail(courseId, activeTab = 'materials') {
    fetch(`api/course_detail.php?action=overview&course_id=${courseId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { alert(data.message || 'Gagal memuat detail kelas.'); return; }
        const c = data.data;
        const stats = data.stats || {};
        const isStaff = this.currentUser.role !== 'siswa';

        let tabNav = `
          <div class="hero-banner mb-3" style="border-left: 5px solid var(--accent);">
            <div style="font-size:2.8rem; margin-right:1rem;">${c.icon || '📚'}</div>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.25rem;">
                <span class="badge badge-cyan">${this.escHtml(c.course_code)}</span>
                <span class="badge badge-amber">${this.escHtml(c.major || 'Umum')}</span>
                <span class="badge badge-green">${this.escHtml(c.class_name || 'Semua Rombel')}</span>
              </div>
              <h2 class="hero-title" style="margin:0.25rem 0;">${this.escHtml(c.course_name)}</h2>
              <div style="color:rgba(255,255,255,0.85);font-size:0.88rem;">
                👨‍🏫 Pengampu: <b>${this.escHtml(c.teacher_name || 'Belum ditugaskan')}</b> &bull;
                📁 ${stats.materials || 0} Materi &bull; 📝 ${stats.assignments || 0} Tugas &bull; 💬 ${stats.discussions || 0} Diskusi
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="App.loadCourses()" style="align-self:flex-start;">⬅ Kembali</button>
          </div>

          <div class="tabs-bar mb-3" style="display:flex;gap:0.5rem;border-bottom:1px solid var(--border);padding-bottom:0.5rem;flex-wrap:wrap;">
            <button class="btn btn-sm ${activeTab === 'materials' ? 'btn-primary' : 'btn-secondary'}" onclick="App.openCourseDetail(${courseId}, 'materials')">📁 Materi (${stats.materials || 0})</button>
            <button class="btn btn-sm ${activeTab === 'assignments' ? 'btn-primary' : 'btn-secondary'}" onclick="App.openCourseDetail(${courseId}, 'assignments')">📝 Tugas (${stats.assignments || 0})</button>
            <button class="btn btn-sm ${activeTab === 'discussions' ? 'btn-primary' : 'btn-secondary'}" onclick="App.openCourseDetail(${courseId}, 'discussions')">💬 Diskusi (${stats.discussions || 0})</button>
            <button class="btn btn-sm ${activeTab === 'info' ? 'btn-primary' : 'btn-secondary'}" onclick="App.openCourseDetail(${courseId}, 'info')">ℹ️ Informasi</button>
          </div>

          <div id="course-tab-container">Memuat konten tab...</div>
        `;

        this.setContent(tabNav);

        if (activeTab === 'materials') this._renderCourseMaterials(courseId, isStaff);
        else if (activeTab === 'assignments') this._renderCourseAssignments(courseId, isStaff);
        else if (activeTab === 'discussions') this._renderCourseDiscussions(courseId);
        else if (activeTab === 'info') this._renderCourseInfo(c, stats);
      });
  },

  _renderCourseMaterials(courseId, isStaff) {
    fetch(`api/course_detail.php?action=materials&course_id=${courseId}`)
      .then(r => r.json())
      .then(d => {
        const materials = d.data || [];
        const container = document.getElementById('course-tab-container');
        if (!container) return;

        const typeIcon = { pdf: '📄', video: '🎥', link: '🔗', text: '📝' };

        const itemsHtml = materials.length ? materials.map((m, i) => `
          <div class="card mb-2" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:1rem;flex:1;min-width:260px;">
              <div style="font-size:2rem;">${typeIcon[m.type] || '📄'}</div>
              <div>
                <div style="font-weight:600;font-size:1rem;color:var(--text-main);">${this.escHtml(m.title)}</div>
                <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem;">
                  Tipe: <span class="badge badge-cyan" style="text-transform:uppercase;">${m.type}</span> &bull;
                  Diunggah oleh: <b>${this.escHtml(m.uploader || 'Guru')}</b> &bull;
                  ${m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'}) : ''}
                </div>
                ${m.content ? `<div style="margin-top:0.5rem;font-size:0.88rem;color:var(--text-sub);">${this.escHtml(m.content)}</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:0.5rem;">
              ${m.content_url ? `<a href="${this.escHtml(m.content_url)}" target="_blank" class="btn btn-primary btn-sm">🔗 Buka / Unduh</a>` : ''}
              ${isStaff ? `<button class="btn btn-danger btn-sm" onclick="App._deleteMaterial(${courseId}, ${m.id})">🗑️</button>` : ''}
            </div>
          </div>
        `).join('') : `<div class="empty-state"><div class="empty-icon">📁</div><p>Belum ada materi pembelajaran yang diunggah.</p></div>`;

        container.innerHTML = `
          <div class="flex-between mb-3">
            <div>
              <div class="section-title" style="font-size:1.1rem;">📁 Modul & Materi Pembelajaran</div>
              <div class="section-sub">Akses materi PDF, slide presentasi, tautan video, atau referensi online.</div>
            </div>
            ${isStaff ? `<button class="btn btn-primary btn-sm" onclick="App._openAddMaterialModal(${courseId})">➕ Upload Materi</button>` : ''}
          </div>
          <div>${itemsHtml}</div>
        `;
      });
  },

  _openAddMaterialModal(courseId) {
    this.openModal('Tambah Materi Pembelajaran Baru', `
      <form onsubmit="App._handleAddMaterial(event, ${courseId})">
        <div class="form-group mb-2"><label class="form-label">Judul Materi</label><input type="text" id="mat-title" class="form-control" placeholder="cth: Modul 1 - Pengenalan HTML5 & CSS3" required></div>
        <div class="form-group mb-2"><label class="form-label">Tipe Materi</label>
          <select id="mat-type" class="form-control" onchange="document.getElementById('mat-url-group').style.display = this.value === 'text' ? 'none' : 'block'">
            <option value="pdf">Dokumen PDF / Slide (PDF)</option>
            <option value="video">Video Pembelajaran (YouTube / Link Video)</option>
            <option value="link">Tautan Web / Sumber Belajar Eksternal</option>
            <option value="text">Catatan Teks / Rangkuman Singkat</option>
          </select>
        </div>
        <div class="form-group mb-2" id="mat-url-group"><label class="form-label">URL / Tautan Dokumen atau Video</label><input type="url" id="mat-url" class="form-control" placeholder="https://..."></div>
        <div class="form-group mb-3"><label class="form-label">Deskripsi / Rangkuman Singkat</label><textarea id="mat-content" class="form-control" rows="3" placeholder="Deskripsi materi atau instruksi baca..."></textarea></div>
        <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Simpan Materi</button></div>
      </form>
    `);
  },

  _handleAddMaterial(e, courseId) {
    e.preventDefault();
    const body = {
      title: document.getElementById('mat-title').value,
      type: document.getElementById('mat-type').value,
      content_url: document.getElementById('mat-url').value,
      content: document.getElementById('mat-content').value
    };
    fetch(`api/course_detail.php?action=add_material&course_id=${courseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json()).then(res => {
      if (res.success) {
        this.closeModal();
        this._renderCourseMaterials(courseId, true);
        this._toast('✅ Materi berhasil ditambahkan!');
      } else alert(res.message);
    });
  },

  _deleteMaterial(courseId, materialId) {
    if (!confirm('Hapus materi ini?')) return;
    fetch(`api/course_detail.php?action=del_material&course_id=${courseId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: materialId })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        this._renderCourseMaterials(courseId, true);
        this._toast('✅ Materi berhasil dihapus.');
      } else alert(res.message);
    });
  },

  _renderCourseAssignments(courseId, isStaff) {
    fetch(`api/course_detail.php?action=assignments&course_id=${courseId}`)
      .then(r => r.json())
      .then(d => {
        const assignments = d.data || [];
        const container = document.getElementById('course-tab-container');
        if (!container) return;

        const itemsHtml = assignments.length ? assignments.map((a, i) => `
          <div class="card mb-2" style="padding:1.25rem;">
            <div class="flex-between mb-1">
              <span class="quiz-card-title">${this.escHtml(a.title)}</span>
              <span class="badge ${a.my_submitted_at ? 'badge-green' : 'badge-amber'}">
                ${isStaff ? `${a.total_submissions || 0} Pengumpulan` : (a.my_submitted_at ? `Terkumpul (Nilai: ${a.my_score !== null ? a.my_score : 'Menunggu Penilaian'})` : 'Belum Mengumpulkan')}
              </span>
            </div>
            <div style="color:var(--text-sub);font-size:0.88rem;margin-bottom:0.75rem;line-height:1.5;">${this.escHtml(a.description || 'Tidak ada deskripsi khusus.')}</div>
            <div class="flex-between" style="font-size:0.82rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:0.75rem;">
              <div>⏳ Tenggat: <b>${a.due_date ? new Date(a.due_date).toLocaleString('id-ID') : 'Tidak dibatasi'}</b> &bull; Nilai Maks: <b>${a.max_score}</b></div>
              <div>
                ${!isStaff ? `<button class="btn btn-primary btn-sm" onclick="alert('Fitur pengumpulan tugas: serahkan berkas ke cbt/uploads/ atau guru pengampu.')">📤 Kumpulkan Tugas</button>` : ''}
              </div>
            </div>
          </div>
        `).join('') : `<div class="empty-state"><div class="empty-icon">📝</div><p>Belum ada tugas atau pekerjaan rumah.</p></div>`;

        container.innerHTML = `
          <div class="flex-between mb-3">
            <div>
              <div class="section-title" style="font-size:1.1rem;">📝 Tugas & Pekerjaan Siswa</div>
              <div class="section-sub">Daftar tugas mandiri, proyek kejuruan, dan pekerjaan rumah.</div>
            </div>
          </div>
          <div>${itemsHtml}</div>
        `;
      });
  },

  _renderCourseDiscussions(courseId) {
    fetch(`api/course_detail.php?action=discussions&course_id=${courseId}`)
      .then(r => r.json())
      .then(d => {
        const threads = d.data || [];
        const container = document.getElementById('course-tab-container');
        if (!container) return;

        const threadsHtml = threads.length ? threads.map(t => `
          <div class="card mb-2" style="padding:1rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
              <span class="badge ${t.author_role === 'guru' ? 'badge-amber' : 'badge-cyan'}">${t.author_role}</span>
              <span style="font-weight:600;font-size:0.9rem;color:var(--text-main);">${this.escHtml(t.author)}</span>
              <span style="font-size:0.78rem;color:var(--text-muted);">${new Date(t.created_at).toLocaleString('id-ID')}</span>
            </div>
            <div style="font-size:0.88rem;color:var(--text-sub);line-height:1.6;margin-bottom:0.5rem;">${this.escHtml(t.message)}</div>
            ${t.replies && t.replies.length ? `
              <div style="margin-left:1.5rem;border-left:2px solid var(--border);padding-left:1rem;margin-top:0.5rem;">
                ${t.replies.map(r => `
                  <div style="font-size:0.82rem;margin-bottom:0.4rem;">
                    <b>${this.escHtml(r.author)}:</b> ${this.escHtml(r.message)}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('') : `<div class="empty-state"><div class="empty-icon">💬</div><p>Belum ada diskusi. Mulai diskusi pertama kelas!</p></div>`;

        container.innerHTML = `
          <div class="card mb-3" style="padding:1rem;">
            <div style="font-weight:600;margin-bottom:0.5rem;font-size:0.92rem;">💬 Kirim Pesan Diskusi Kelas</div>
            <div style="display:flex;gap:0.5rem;">
              <input type="text" id="disc-msg" class="form-control" placeholder="Tulis pertanyaan atau tanggapan untuk kelas ini..." style="flex:1;">
              <button class="btn btn-primary" onclick="App._sendDiscussion(${courseId})">Kirim 🚀</button>
            </div>
          </div>
          <div>${threadsHtml}</div>
        `;
      });
  },

  _sendDiscussion(courseId) {
    const input = document.getElementById('disc-msg');
    const msg = input ? input.value.trim() : '';
    if (!msg) return;

    fetch(`api/course_detail.php?action=discussions&course_id=${courseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        input.value = '';
        this._renderCourseDiscussions(courseId);
        this._toast('✅ Pesan diskusi terkirim.');
      } else alert(res.message);
    });
  },

  _renderCourseInfo(c, stats) {
    const container = document.getElementById('course-tab-container');
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="padding:1.5rem;">
        <h3 style="margin-bottom:1rem;font-size:1.1rem;color:var(--text-main);">Informasi Lengkap Mata Pelajaran</h3>
        <table class="data-table mb-3">
          <tbody>
            <tr><td style="width:200px;font-weight:600;">Kode Mata Pelajaran</td><td><code>${this.escHtml(c.course_code)}</code></td></tr>
            <tr><td style="font-weight:600;">Nama Mata Pelajaran</td><td><b>${this.escHtml(c.course_name)}</b></td></tr>
            <tr><td style="font-weight:600;">Jurusan Keahlian</td><td><span class="badge badge-amber">${this.escHtml(c.major || 'Umum')}</span></td></tr>
            <tr><td style="font-weight:600;">Rombel / Kelas Sasaran</td><td>${this.escHtml(c.class_name || 'Semua Kelas')}</td></tr>
            <tr><td style="font-weight:600;">Guru Pengampu</td><td>👨‍🏫 ${this.escHtml(c.teacher_name || 'Belum ditugaskan')}</td></tr>
            <tr><td style="font-weight:600;">Total Evaluasi CBT</td><td>📝 ${stats.quizzes || 0} Paket Ujian Aktif</td></tr>
            <tr><td style="font-weight:600;">Deskripsi Mapel</td><td>${this.escHtml(c.description || 'Mata pelajaran kejuruan kurikulum merdeka SMKN 1 CIBINONG.')}</td></tr>
          </tbody>
        </table>
        <div style="display:flex;gap:0.75rem;">
          <button class="btn btn-primary" onclick="App.renderAppLayout('cbt')">📝 Buka Ujian CBT Mapel Ini</button>
          <button class="btn btn-secondary" onclick="App.renderAppLayout('schedules')">📅 Cek Jadwal Kelas</button>
        </div>
      </div>
    `;
  },


  /* ────────────────────────────────────────────────────────────────────────────
     CLASSES
  ──────────────────────────────────────────────────────────────────────────── */
  loadClasses() {
    fetch('api/classes.php')
      .then(r => r.json())
      .then(data => {
        const classes = data.classes || [];
        const isStaff = this.currentUser.role !== 'siswa';

        const rows = classes.length ? classes.map((cl, i) => `
          <tr>
            <td class="td-mono">${i + 1}</td>
            <td class="td-main">${this.escHtml(cl.class_name)}</td>
            <td>${this.escHtml(cl.academic_year)}</td>
            <td><span class="badge badge-cyan">${cl.student_count || 0} siswa</span></td>
            <td>${isStaff ? `<button class="btn btn-danger btn-sm" onclick="App.deleteClass(${cl.id})">🗑️</button>` : '—'}</td>
          </tr>
        `).join('') : `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🏛️</div><p>Belum ada kelas.</p></div></td></tr>`;

        this.setContent(`
          <div class="flex-between mb-3">
            <div>
              <div class="section-title">🏛️ Kelas & Rombel</div>
              <div class="section-sub">Manajemen kelas dan rombongan belajar SMKN 1 CIBINONG.</div>
            </div>
            ${isStaff ? `<button class="btn btn-primary" onclick="App.openAddClassModal()">➕ Tambah Kelas</button>` : ''}
          </div>
          <div class="card">
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>#</th><th>Nama Kelas</th><th>Tahun Ajaran</th><th>Jumlah Siswa</th><th>Aksi</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        `);
      });
  },

  openAddClassModal() {
    this.openModal('Tambah Kelas / Rombel Baru', `
      <form onsubmit="App.handleAddClass(event)">
        <div class="form-group mb-2"><label class="form-label">Nama Kelas</label><input type="text" id="cl-name" class="form-control" placeholder="cth: X RPL 1" required></div>
        <div class="form-group mb-3"><label class="form-label">Tahun Ajaran</label><input type="text" id="cl-year" class="form-control" value="2026/2027" required></div>
        <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Simpan Kelas</button></div>
      </form>
    `);
  },

  handleAddClass(e) {
    e.preventDefault();
    fetch('api/classes.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', class_name: document.getElementById('cl-name').value, academic_year: document.getElementById('cl-year').value }) })
      .then(r => r.json()).then(d => { if (d.success) { this.closeModal(); this.loadClasses(); } else alert(d.message); });
  },

  deleteClass(id) {
    if (!confirm('Hapus kelas ini?')) return;
    fetch('api/classes.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', class_id: id }) }).then(() => this.loadClasses());
  },

  /* ────────────────────────────────────────────────────────────────────────────
     SCHEDULES
  ──────────────────────────────────────────────────────────────────────────── */
  loadSchedules() {
    fetch('api/schedules.php')
      .then(r => r.json())
      .then(data => {
        const schedules = data.data || [];
        const isStaff = this.currentUser.role !== 'siswa';

        const rows = schedules.length ? schedules.map((s, i) => `
          <tr>
            <td class="td-mono">${i + 1}</td>
            <td class="td-main">${this.escHtml(s.course_name)}</td>
            <td><span class="badge badge-cyan">${s.day_of_week}</span></td>
            <td class="td-mono">${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}</td>
            <td>${this.escHtml(s.class_name)}</td>
            <td>${this.escHtml(s.room || '-')}</td>
            <td>${this.escHtml(s.teacher_name || '-')}</td>
            ${isStaff ? `<td><button class="btn btn-danger btn-sm" onclick="App.deleteSchedule(${s.id})">🗑️</button></td>` : ''}
          </tr>
        `).join('') : `<tr><td colspan="${isStaff ? 8 : 7}"><div class="empty-state"><div class="empty-icon">📅</div><p>Belum ada jadwal kelas.</p></div></td></tr>`;

        this.setContent(`
          <div class="flex-between mb-3">
            <div>
              <div class="section-title">📅 Jadwal Kelas</div>
              <div class="section-sub">Informasi jadwal mata pelajaran harian.</div>
            </div>
            ${isStaff ? `<button class="btn btn-primary" onclick="App.openAddScheduleModal()">➕ Tambah Jadwal</button>` : ''}
          </div>
          <div class="card">
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Mata Pelajaran</th><th>Hari</th><th>Jam</th><th>Kelas</th><th>Ruang</th><th>Guru/Pembuat</th>${isStaff ? '<th>Aksi</th>' : ''}
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        `);
      });
  },

  openAddScheduleModal() {
    Promise.all([
      fetch('api/courses.php').then(r => r.json()),
      fetch('api/classes.php').then(r => r.json())
    ]).then(([dCrs, dCls]) => {
      const courses = dCrs.courses || [];
      const classes = dCls.classes || [];
      const optC = courses.map(c => `<option value="${c.id}">${this.escHtml(c.course_name)}</option>`).join('');
      const optCl = classes.map(c => `<option value="${c.id}">${this.escHtml(c.class_name)}</option>`).join('');
      
      this.openModal('Tambah Jadwal Baru', `
        <form onsubmit="App.handleAddSchedule(event)">
          <div class="form-group mb-2"><label class="form-label">Mata Pelajaran</label><select id="sch-course" class="form-control" required>${optC}</select></div>
          <div class="form-group mb-2"><label class="form-label">Kelas</label><select id="sch-class" class="form-control" required>${optCl}</select></div>
          <div class="form-group mb-2"><label class="form-label">Hari</label>
            <select id="sch-day" class="form-control" required>
              <option value="Senin">Senin</option><option value="Selasa">Selasa</option>
              <option value="Rabu">Rabu</option><option value="Kamis">Kamis</option>
              <option value="Jumat">Jumat</option><option value="Sabtu">Sabtu</option>
            </select>
          </div>
          <div style="display:flex; gap:1rem;" class="mb-2">
            <div class="form-group" style="flex:1;"><label class="form-label">Jam Mulai</label><input type="time" id="sch-start" class="form-control" required></div>
            <div class="form-group" style="flex:1;"><label class="form-label">Jam Selesai</label><input type="time" id="sch-end" class="form-control" required></div>
          </div>
          <div class="form-group mb-3"><label class="form-label">Ruang (Opsional)</label><input type="text" id="sch-room" class="form-control" placeholder="cth: Lab Komputer 1"></div>
          <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
        </form>
      `);
    });
  },

  handleAddSchedule(e) {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('course_id', document.getElementById('sch-course').value);
    formData.append('class_id', document.getElementById('sch-class').value);
    formData.append('day_of_week', document.getElementById('sch-day').value);
    formData.append('start_time', document.getElementById('sch-start').value);
    formData.append('end_time', document.getElementById('sch-end').value);
    formData.append('room', document.getElementById('sch-room').value);

    fetch('api/schedules.php', { method: 'POST', body: formData })
      .then(r => r.json()).then(d => { if (d.success) { this.closeModal(); this.loadSchedules(); } else alert(d.message); });
  },

  deleteSchedule(id) {
    if (!confirm('Hapus jadwal kelas ini?')) return;
    fetch('api/schedules.php', { method: 'DELETE', body: 'id='+id, headers: {'Content-Type': 'application/x-www-form-urlencoded'} })
      .then(() => this.loadSchedules());
  },

  /* ────────────────────────────────────────────────────────────────────────────
     CBT
  ──────────────────────────────────────────────────────────────────────────── */
  loadCbt() {
    if (this.currentUser.role === 'siswa') this.loadStudentCbt();
    else this.loadTeacherCbt();
  },

  // TEACHER CBT VIEW
  loadTeacherCbt() {
    fetch('api/quizzes.php')
      .then(r => r.json())
      .then(data => {
        const quizzes = data.quizzes || data.data || [];
        const cards = quizzes.length ? quizzes.map(q => {
          const qCount = q.question_count !== undefined ? q.question_count : (q.total_questions !== undefined ? q.total_questions : 0);
          return `
          <div class="quiz-card">
            <div>
              <div class="quiz-card-meta">
                <span class="badge badge-cyan">${qCount} Soal</span>
                <span class="badge badge-amber">⏱ ${q.duration_minutes} Menit</span>
                <span class="badge badge-green">KKM: ${q.kkm || 70}</span>
                <span class="badge ${q.status === 'active' ? 'badge-green' : 'badge-muted'}">${q.status}</span>
              </div>
              <div class="quiz-card-title">${this.escHtml(q.title)}</div>
              <div class="quiz-card-desc">${this.escHtml(q.description || 'Tidak ada deskripsi.')}</div>
            </div>
            <div class="quiz-card-actions">
              <button class="btn btn-outline btn-full" onclick="App.openManageQuestions(${q.id})">📝 Kelola Soal (${qCount})</button>
              <div class="flex-gap-1 mt-1">
                <button class="btn btn-secondary" style="flex:1;justify-content:center;" onclick="App.openMonitoringModal(${q.id})">🛡️ Monitoring</button>
                <button class="btn btn-secondary btn-sm" onclick="App.openEditQuizModal(${q.id})" title="Edit Ujian">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="App.deleteQuiz(${q.id})" title="Hapus Ujian">🗑️</button>
              </div>
            </div>
          </div>
        `;}).join('') : `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📝</div><p>Belum ada paket ujian. Buat ujian pertama Anda!</p></div>`;

        this.setContent(`
          <div class="flex-between mb-3">
            <div>
              <div class="section-title">📝 Manajemen Ujian CBT</div>
              <div class="section-sub">Buat soal, kelola ujian, dan pantau deteksi kecurangan siswa.</div>
            </div>
            <button class="btn btn-primary" onclick="App.openCreateQuizModal()">➕ Buat Ujian Baru</button>
          </div>
          <div class="cards-grid">${cards}</div>
        `);
      });
  },

  openCreateQuizModal() {
    this.openModal('Buat Paket Ujian CBT Baru', `
      <form onsubmit="App.handleCreateQuiz(event)">
        <div class="form-group mb-2"><label class="form-label">Judul Ujian</label><input type="text" id="qz-title" class="form-control" placeholder="cth: UTS Pemrograman Web Ganjil 2026" required></div>
        <div class="form-group mb-2"><label class="form-label">Deskripsi / Instruksi</label><textarea id="qz-desc" class="form-control" rows="3" placeholder="Instruksi pengerjaan ujian…"></textarea></div>
        <div style="display:flex;gap:0.75rem;" class="mb-2">
          <div class="form-group" style="flex:1;"><label class="form-label">Durasi (Menit)</label><input type="number" id="qz-dur" class="form-control" value="45" min="5" max="180" required></div>
          <div class="form-group" style="flex:1;"><label class="form-label">KKM (0-100)</label><input type="number" id="qz-kkm" class="form-control" value="70" min="0" max="100" required></div>
        </div>
        <div class="form-group mb-3"><label class="form-label">Status Awal</label>
          <select id="qz-status" class="form-control">
            <option value="active">Active (Langsung Dapat Diakses)</option>
            <option value="draft">Draft (Simpan Draf Terlebih Dahulu)</option>
          </select>
        </div>
        <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Buat Ujian</button></div>
      </form>
    `);
  },

  handleCreateQuiz(e) {
    e.preventDefault();
    fetch('api/quizzes.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        title: document.getElementById('qz-title').value,
        description: document.getElementById('qz-desc').value,
        duration_minutes: document.getElementById('qz-dur').value,
        kkm: document.getElementById('qz-kkm') ? document.getElementById('qz-kkm').value : 70,
        status: document.getElementById('qz-status') ? document.getElementById('qz-status').value : 'active'
      })
    })
      .then(r => r.json()).then(d => {
        if (d.success) {
          this.closeModal();
          this.loadTeacherCbt();
          this._toast('✅ Paket ujian berhasil dibuat.');
        } else alert(d.message);
      });
  },

  openEditQuizModal(quizId) {
    fetch(`api/quizzes.php?action=detail&id=${quizId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { alert(d.message || 'Gagal memuat detail ujian.'); return; }
        const q = d.data;
        this.openModal('Edit Paket Ujian CBT', `
          <form onsubmit="App.handleEditQuiz(event, ${quizId})">
            <div class="form-group mb-2"><label class="form-label">Judul Ujian</label><input type="text" id="eqz-title" class="form-control" value="${this.escHtml(q.title)}" required></div>
            <div class="form-group mb-2"><label class="form-label">Deskripsi / Instruksi</label><textarea id="eqz-desc" class="form-control" rows="3">${this.escHtml(q.description || '')}</textarea></div>
            <div style="display:flex;gap:0.75rem;" class="mb-2">
              <div class="form-group" style="flex:1;"><label class="form-label">Durasi (Menit)</label><input type="number" id="eqz-dur" class="form-control" value="${q.duration_minutes || 45}" min="5" max="180" required></div>
              <div class="form-group" style="flex:1;"><label class="form-label">KKM</label><input type="number" id="eqz-kkm" class="form-control" value="${q.kkm || 70}" min="0" max="100" required></div>
            </div>
            <div style="display:flex;gap:0.75rem;" class="mb-3">
              <div class="form-group" style="flex:1;"><label class="form-label">Status</label>
                <select id="eqz-status" class="form-control">
                  <option value="active" ${q.status === 'active' ? 'selected' : ''}>Active (Siap Dikerjakan)</option>
                  <option value="draft" ${q.status === 'draft' ? 'selected' : ''}>Draft (Ditutup)</option>
                </select>
              </div>
              <div class="form-group" style="flex:1;"><label class="form-label">Tanggal Rilis (Opsional)</label><input type="date" id="eqz-release" class="form-control" value="${q.release_date || ''}"></div>
            </div>
            <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Simpan Perubahan</button></div>
          </form>
        `);
      });
  },

  handleEditQuiz(e, quizId) {
    e.preventDefault();
    fetch('api/quizzes.php', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: quizId,
        title: document.getElementById('eqz-title').value,
        description: document.getElementById('eqz-desc').value,
        duration_minutes: document.getElementById('eqz-dur').value,
        kkm: document.getElementById('eqz-kkm').value,
        status: document.getElementById('eqz-status').value,
        release_date: document.getElementById('eqz-release').value || null
      })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        this.closeModal();
        this.loadTeacherCbt();
        this._toast('✅ Paket ujian berhasil diperbarui.');
      } else alert(d.message);
    });
  },

  deleteQuiz(id) {
    if (!confirm('Hapus ujian ini beserta semua soalnya?')) return;
    fetch('api/quizzes.php', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) })
      .then(r => r.json())
      .then(() => {
        this.loadTeacherCbt();
        this._toast('✅ Paket ujian dihapus.');
      });
  },

  openManageQuestions(quizId) {
    fetch(`api/questions.php?quiz_id=${quizId}`)
      .then(r => r.json())
      .then(data => {
        const questions = data.questions || [];
        const rows = questions.length ? questions.map((q, i) => {
          const isEssay = q.type === 'essay';
          return `
          <tr>
            <td class="td-mono">${i + 1}</td>
            <td><span class="badge ${isEssay ? 'badge-amber' : 'badge-cyan'}">${isEssay ? 'Essai' : 'Pilihan Ganda'}</span></td>
            <td class="td-main" style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escHtml(q.question_text)}</td>
            <td>
              ${isEssay 
                ? `<span class="badge badge-amber" title="${this.escHtml(q.essay_answer || 'Pedoman manual')}">Pedoman Guru</span>` 
                : `<span class="badge badge-green">Jwb: ${q.correct_option}</span>`}
            </td>
            <td><span class="badge badge-cyan">${q.points || 1} Poin</span></td>
            <td>
              <div style="display:flex;gap:0.35rem;">
                <button class="btn btn-secondary btn-sm" onclick="App.openEditQuestionModal(${q.id}, ${quizId})" title="Edit Soal">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="App.deleteQuestion(${q.id}, ${quizId})" title="Hapus Soal">🗑️</button>
              </div>
            </td>
          </tr>
        `;}).join('') : `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📝</div><p>Belum ada soal. Tambah soal pertama!</p></div></td></tr>`;

        this.openModal('Kelola Soal Ujian', `
          <div class="flex-between mb-2">
            <span class="badge badge-cyan">${questions.length} Soal Terdaftar</span>
            <button class="btn btn-primary btn-sm" onclick="App.openAddQuestionModal(${quizId})">➕ Tambah Soal</button>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>#</th><th>Tipe</th><th>Pertanyaan</th><th>Kunci / Pedoman</th><th>Bobot</th><th>Aksi</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `, 'modal-box modal-box-lg');
      });
  },

  openAddQuestionModal(quizId) {
    this.closeModal();
    this.openModal('Tambah Soal Baru', `
      <form onsubmit="App.handleAddQuestion(event,${quizId})">
        <div class="form-group mb-2">
          <label class="form-label">Tipe Soal</label>
          <select id="q-type" class="form-control" onchange="App._toggleQuestionType(this.value)">
            <option value="multiple_choice">Pilihan Ganda (A, B, C, D)</option>
            <option value="essay">Essai / Uraian</option>
          </select>
        </div>
        <div class="form-group mb-2">
          <label class="form-label">Teks Pertanyaan</label>
          <textarea id="q-text" class="form-control" rows="3" required placeholder="Masukkan teks pertanyaan soal…"></textarea>
        </div>
        <div id="q-mc-group">
          <div class="grid-2col mb-2" style="gap:0.6rem;">
            <div class="form-group"><label class="form-label">Pilihan A</label><input type="text" id="q-a" class="form-control"></div>
            <div class="form-group"><label class="form-label">Pilihan B</label><input type="text" id="q-b" class="form-control"></div>
            <div class="form-group"><label class="form-label">Pilihan C</label><input type="text" id="q-c" class="form-control"></div>
            <div class="form-group"><label class="form-label">Pilihan D</label><input type="text" id="q-d" class="form-control"></div>
          </div>
          <div class="form-group mb-2"><label class="form-label">Kunci Jawaban Benar</label>
            <select id="q-key" class="form-control">
              <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
            </select>
          </div>
        </div>
        <div id="q-essay-group" style="display:none;" class="mb-2">
          <div class="form-group"><label class="form-label">Pedoman Penilaian / Kunci Jawaban Essai</label>
            <textarea id="q-essay-ans" class="form-control" rows="3" placeholder="Kriteria jawaban benar untuk panduan penilaian guru…"></textarea>
          </div>
        </div>
        <div class="form-group mb-3"><label class="form-label">Bobot Poin</label>
          <input type="number" id="q-points" class="form-control" value="1" min="1" max="100">
        </div>
        <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Simpan Soal</button></div>
      </form>
    `);
  },

  _toggleQuestionType(type) {
    const mc = document.getElementById('q-mc-group');
    const es = document.getElementById('q-essay-group');
    if (mc && es) {
      mc.style.display = type === 'multiple_choice' ? 'block' : 'none';
      es.style.display = type === 'essay' ? 'block' : 'none';
    }
  },

  handleAddQuestion(e, quizId) {
    e.preventDefault();
    const type = document.getElementById('q-type').value;
    const body = {
      action: 'create',
      quiz_id: quizId,
      type: type,
      question_text: document.getElementById('q-text').value,
      points: document.getElementById('q-points').value || 1
    };
    if (type === 'multiple_choice') {
      body.option_a = document.getElementById('q-a').value;
      body.option_b = document.getElementById('q-b').value;
      body.option_c = document.getElementById('q-c').value;
      body.option_d = document.getElementById('q-d').value;
      body.correct_option = document.getElementById('q-key').value;
    } else {
      body.essay_answer = document.getElementById('q-essay-ans').value;
    }

    fetch('api/questions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json()).then(d => {
      if (d.success) {
        this.closeModal();
        this.openManageQuestions(quizId);
        this._toast('✅ Soal berhasil ditambahkan!');
      } else alert(d.message);
    });
  },

  openEditQuestionModal(qId, quizId) {
    fetch(`api/questions.php?quiz_id=${quizId}`)
      .then(r => r.json())
      .then(data => {
        const questions = data.questions || [];
        const q = questions.find(item => item.id == qId);
        if (!q) { alert('Data soal tidak ditemukan.'); return; }

        this.closeModal();
        const isEssay = q.type === 'essay';

        this.openModal('Edit Soal Ujian', `
          <form onsubmit="App.handleEditQuestion(event, ${qId}, ${quizId})">
            <div class="form-group mb-2">
              <label class="form-label">Tipe Soal</label>
              <select id="eq-type" class="form-control" onchange="App._toggleEditQuestionType(this.value)">
                <option value="multiple_choice" ${!isEssay ? 'selected' : ''}>Pilihan Ganda (A, B, C, D)</option>
                <option value="essay" ${isEssay ? 'selected' : ''}>Essai / Uraian</option>
              </select>
            </div>
            <div class="form-group mb-2">
              <label class="form-label">Teks Pertanyaan</label>
              <textarea id="eq-text" class="form-control" rows="3" required>${this.escHtml(q.question_text)}</textarea>
            </div>
            <div id="eq-mc-group" style="${isEssay ? 'display:none;' : ''}">
              <div class="grid-2col mb-2" style="gap:0.6rem;">
                <div class="form-group"><label class="form-label">Pilihan A</label><input type="text" id="eq-a" class="form-control" value="${this.escHtml(q.option_a || '')}"></div>
                <div class="form-group"><label class="form-label">Pilihan B</label><input type="text" id="eq-b" class="form-control" value="${this.escHtml(q.option_b || '')}"></div>
                <div class="form-group"><label class="form-label">Pilihan C</label><input type="text" id="eq-c" class="form-control" value="${this.escHtml(q.option_c || '')}"></div>
                <div class="form-group"><label class="form-label">Pilihan D</label><input type="text" id="eq-d" class="form-control" value="${this.escHtml(q.option_d || '')}"></div>
              </div>
              <div class="form-group mb-2"><label class="form-label">Kunci Jawaban Benar</label>
                <select id="eq-key" class="form-control">
                  <option value="A" ${q.correct_option === 'A' ? 'selected' : ''}>A</option>
                  <option value="B" ${q.correct_option === 'B' ? 'selected' : ''}>B</option>
                  <option value="C" ${q.correct_option === 'C' ? 'selected' : ''}>C</option>
                  <option value="D" ${q.correct_option === 'D' ? 'selected' : ''}>D</option>
                </select>
              </div>
            </div>
            <div id="eq-essay-group" style="${!isEssay ? 'display:none;' : ''}" class="mb-2">
              <div class="form-group"><label class="form-label">Pedoman Penilaian / Kunci Jawaban Essai</label>
                <textarea id="eq-essay-ans" class="form-control" rows="3">${this.escHtml(q.essay_answer || '')}</textarea>
              </div>
            </div>
            <div class="form-group mb-3"><label class="form-label">Bobot Poin</label>
              <input type="number" id="eq-points" class="form-control" value="${q.points || 1}" min="1" max="100">
            </div>
            <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Simpan Perubahan</button></div>
          </form>
        `);
      });
  },

  _toggleEditQuestionType(type) {
    const mc = document.getElementById('eq-mc-group');
    const es = document.getElementById('eq-essay-group');
    if (mc && es) {
      mc.style.display = type === 'multiple_choice' ? 'block' : 'none';
      es.style.display = type === 'essay' ? 'block' : 'none';
    }
  },

  handleEditQuestion(e, qId, quizId) {
    e.preventDefault();
    const type = document.getElementById('eq-type').value;
    const body = {
      action: 'update',
      id: qId,
      type: type,
      question_text: document.getElementById('eq-text').value,
      points: document.getElementById('eq-points').value || 1
    };
    if (type === 'multiple_choice') {
      body.option_a = document.getElementById('eq-a').value;
      body.option_b = document.getElementById('eq-b').value;
      body.option_c = document.getElementById('eq-c').value;
      body.option_d = document.getElementById('eq-d').value;
      body.correct_option = document.getElementById('eq-key').value;
    } else {
      body.essay_answer = document.getElementById('eq-essay-ans').value;
    }

    fetch('api/questions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json()).then(d => {
      if (d.success) {
        this.closeModal();
        this.openManageQuestions(quizId);
        this._toast('✅ Soal berhasil diperbarui!');
      } else alert(d.message);
    });
  },

  deleteQuestion(qId, quizId) {
    if (!confirm('Hapus soal ini?')) return;
    fetch('api/questions.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', question_id: qId }) })
      .then(() => {
        this.openManageQuestions(quizId);
        this._toast('✅ Soal berhasil dihapus.');
      });
  },

  // MONITORING MODAL — Incident Forensics
  openMonitoringModal(quizId) {
    fetch(`api/exam.php?action=monitor&quiz_id=${quizId}`)
      .then(r => r.json())
      .then(data => {
        const attempts  = data.attempts || [];
        const total     = attempts.length;
        const clean     = attempts.filter(a => a.violations_count == 0 && a.status !== 'disqualified').length;
        const warned    = attempts.filter(a => a.violations_count > 0 && a.status !== 'disqualified').length;
        const disq      = attempts.filter(a => a.status === 'disqualified').length;

        const tableRows = attempts.length ? attempts.map(att => {
          let lvl = '';
          if (att.status === 'disqualified' || att.violations_count >= 3) lvl = `<span class="badge badge-danger">🔒 3/3 DISQ</span>`;
          else if (att.violations_count === 2) lvl = `<span class="badge badge-amber">⚠️ 2/3</span>`;
          else if (att.violations_count === 1) lvl = `<span class="badge badge-amber">⚠️ 1/3</span>`;
          else lvl = `<span class="badge badge-green">✓ CLEAN</span>`;

          const logs = att.cheat_logs?.length ? `<ul style="padding-left:1rem;margin:0;font-size:0.77rem;line-height:1.4;">${att.cheat_logs.map(l => `<li><span class="text-danger">[${(l.created_at||'').split(' ')[1]||''}]</span> ${this.escHtml(l.details)}</li>`).join('')}</ul>` : `<span class="text-green" style="font-size:0.82rem;">✓ Tidak ada pelanggaran</span>`;

          return `
            <tr style="${att.status === 'disqualified' ? 'background:rgba(239,68,68,0.06);' : ''}">
              <td>
                <div class="font-700">${this.escHtml(att.student_name)}</div>
                <div class="td-mono">NIS: ${att.student_nis || att.student_username}</div>
              </td>
              <td>
                ${att.status === 'completed'    ? `<span class="badge badge-green">SELESAI</span>` : ''}
                ${att.status === 'disqualified' ? `<span class="badge badge-danger">DIDISQ</span>` : ''}
                ${att.status === 'in_progress'  ? `<span class="badge badge-cyan">BERLANGSUNG</span>` : ''}
              </td>
              <td><span class="font-mono font-800" style="font-size:1.1rem;color:var(--cyan);">${att.score}</span><span class="text-muted"> /100</span></td>
              <td>${lvl}</td>
              <td style="max-width:240px;">${logs}</td>
              <td><button class="btn btn-amber btn-sm" onclick="App.resetStudentExam(${att.id},'${this.escHtml(att.student_name)}',${quizId})">🔄 Reset & Buka</button></td>
            </tr>
          `;
        }).join('') : `<tr><td colspan="6"><div class="empty-state"><p>Belum ada siswa yang mengerjakan ujian ini.</p></div></td></tr>`;

        this.openModal('🛡️ Incident Forensics & Monitoring Ujian', `
          <div class="incident-kpi-bar">
            <div class="incident-kpi"><div class="incident-kpi-label text-muted">Total Peserta</div><div class="incident-kpi-val">${total}</div></div>
            <div class="incident-kpi"><div class="incident-kpi-label" style="color:var(--emerald);">Tertib (Clean)</div><div class="incident-kpi-val text-green">${clean}</div></div>
            <div class="incident-kpi"><div class="incident-kpi-label" style="color:var(--amber);">Peringatan Tab</div><div class="incident-kpi-val text-amber">${warned}</div></div>
            <div class="incident-kpi"><div class="incident-kpi-label" style="color:var(--danger);">Didiskualifikasi</div><div class="incident-kpi-val text-danger">${disq}</div></div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Kandidat</th><th>Status</th><th>Skor</th><th>Level</th><th>Log Forensik</th><th>Aksi Admin</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        `, 'modal-box modal-box-lg');
      });
  },

  resetStudentExam(attemptId, studentName, quizId) {
    if (!confirm(`Reset ujian untuk "${studentName}"?\n\nSemua jawaban, skor, dan status diskualifikasi akan dihapus. Siswa dapat mengerjakan kembali dari awal.`)) return;
    fetch('api/exam.php?action=reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt_id: attemptId }) })
      .then(r => r.json())
      .then(d => { alert(d.message); this.openMonitoringModal(quizId); });
  },

  // STUDENT CBT VIEW
  loadStudentCbt() {
    fetch('api/quizzes.php')
      .then(r => r.json())
      .then(data => {
        const quizzes = data.quizzes || data.data || [];
        const cards = quizzes.length ? quizzes.map(q => {
          const att = q.my_attempt || (q.attempt_status ? { status: q.attempt_status, score: q.attempt_score, id: q.attempt_id } : null);
          const qCount = q.total_questions !== undefined ? q.total_questions : (q.question_count !== undefined ? q.question_count : 0);
          let action = '';
          if (!att) action = `<button class="btn btn-primary btn-full" onclick="App.confirmStartExam(${q.id},'${this.escHtml(q.title)}')">🚀 Mulai Ujian</button>`;
          else if (att.status === 'in_progress') action = `<button class="btn btn-amber btn-full" onclick="App.startExam(${q.id})">▶️ Lanjutkan Ujian</button>`;
          else if (att.status === 'disqualified') action = `<div style="background:var(--danger-dim);border:1px solid rgba(239,68,68,0.3);padding:0.75rem;border-radius:var(--r-md);text-align:center;"><span class="text-danger font-700">🚫 Didiskualifikasi (Keluar tab > 3x)</span><br><small class="text-muted">Lapor ke Admin/Guru untuk Reset Ujian</small></div>`;
          else action = `<div style="background:var(--emerald-dim);border:1px solid rgba(16,185,129,0.3);padding:0.75rem;border-radius:var(--r-md);text-align:center;"><span class="text-green font-700">✅ Ujian Selesai</span><br><span style="font-size:1.2rem;font-weight:800;color:var(--cyan);">Skor: ${att.score} / 100</span></div>`;

          return `
            <div class="quiz-card">
              <div>
                <div class="quiz-card-meta">
                  <span class="badge badge-cyan">${qCount} Soal</span>
                  <span class="badge badge-amber">⏱ ${q.duration_minutes} Menit</span>
                </div>
                <div class="quiz-card-title">${this.escHtml(q.title)}</div>
                <div class="quiz-card-desc">${this.escHtml(q.description || 'Kerjakan dengan jujur dan teliti.')}</div>
              </div>
              <div style="margin-top:1rem;">${action}</div>
            </div>
          `;
        }).join('') : `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📝</div><p>Belum ada ujian aktif saat ini.</p></div>`;

        this.setContent(`
          <div class="mb-3">
            <div class="section-title">📝 Ujian CBT Online</div>
            <div class="section-sub">Pilih paket ujian aktif. Selama ujian, dilarang berpindah tab atau meminimalkan layar.</div>
          </div>
          <div class="cards-grid">${cards}</div>
        `);
      });
  },

  confirmStartExam(quizId, title) {
    this.openModal('🔒 Konfirmasi Proteksi Anti-Cheating', `
      <div style="text-align:center;">
        <div style="font-size:3.5rem;margin-bottom:1rem;">🛡️</div>
        <h2 style="font-size:1.2rem;margin-bottom:0.75rem;">Ujian: ${this.escHtml(title)}</h2>
        <p style="color:var(--text-sub);font-size:0.88rem;line-height:1.7;margin-bottom:1.5rem;">
          Ujian ini menggunakan sistem <b>E-Learning SMKN 1 CIBINONG Anti-Cheat Guard</b>.<br>
          1. Layar dikunci ke mode <b>Layar Penuh (Fullscreen)</b>.<br>
          2. <b>DILARANG</b> berpindah tab, membuka jendela lain, atau menekan Alt+Tab.<br>
          3. Berpindah tab <b>&gt; 3x</b> → Otomatis <b style="color:var(--danger);">DIDISKUALIFIKASI</b>.<br>
          <span style="font-style:italic;color:var(--text-muted);">(Kendala teknis? Lapor ke Pengawas/Admin untuk Reset Ujian.)</span>
        </p>
        <div style="display:flex;gap:0.5rem;justify-content:center;">
          <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="App.closeModal();App.startExam(${quizId});">Saya Paham, Mulai Ujian 🚀</button>
        </div>
      </div>
    `);
  },

  startExam(quizId) {
    fetch('api/exam.php?action=start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quiz_id: quizId }) })
      .then(r => r.json())
      .then(data => {
        if (!data.success) { alert(data.message); return; }
        this.currentQuiz          = data.quiz;
        this.questions            = data.questions;
        this.savedAnswers         = data.saved_answers || {};
        this.flaggedQuestions     = {};
        this.attemptId            = data.attempt_id;
        this.currentQuestionIndex = 0;

        if (!this.questions.length) { alert('Belum ada soal pada ujian ini.'); return; }

        window.ExamGuard.start(this.attemptId, data.violations_count || 0, v => this.onViolation(v), d => this.onDisqualified(d));
        this.startTimer(this.currentQuiz.duration_minutes * 60);
        this.renderExamScreen();
      });
  },

  onViolation(v) {
    let modal = document.getElementById('viol-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'viol-modal';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="modal-box" style="text-align:center;border:2px solid var(--danger);max-width:420px;">
        <div style="font-size:3rem;color:var(--amber);margin-bottom:0.75rem;">⚠️</div>
        <h2 style="color:var(--danger);margin-bottom:0.5rem;">PELANGGARAN TERDETEKSI!</h2>
        <p style="color:var(--text-sub);font-size:0.92rem;margin-bottom:0.5rem;">Anda terdeteksi keluar dari halaman ujian.</p>
        <p style="font-size:1.2rem;font-weight:800;color:var(--amber);margin-bottom:1.25rem;">Pelanggaran: ${v.violations_count} / ${v.max_violations}</p>
        <button class="btn btn-amber btn-full" onclick="document.getElementById('viol-modal').remove();window.ExamGuard.requestFullscreen();">
          Kembali ke Layar Penuh Ujian
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    const vt = document.getElementById('viol-count-display');
    if (vt) vt.textContent = `${v.violations_count} / ${v.max_violations}`;
  },

  onDisqualified(d) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    let modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.style.zIndex = '999999';
    modal.innerHTML = `
      <div class="modal-box" style="text-align:center;border:2px solid var(--danger);max-width:440px;">
        <div style="font-size:4rem;color:var(--danger);margin-bottom:0.5rem;">🚫</div>
        <h1 style="color:#f87171;font-size:1.5rem;margin-bottom:0.75rem;">ANDA DIDISKUALIFIKASI</h1>
        <p style="color:var(--text-sub);font-size:0.92rem;margin-bottom:0.5rem;">${d.message || 'Anda telah keluar tab ujian lebih dari 3x.'}</p>
        <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:1.5rem;">Jika ini merupakan kendala teknis, silakan lapor kepada Pengawas/Admin untuk melakukan <b>Reset Ujian</b>.</p>
        <button class="btn btn-danger btn-full" onclick="location.reload();">Keluar ke Dashboard</button>
      </div>
    `;
    document.body.appendChild(modal);
  },

  // EXAM SCREEN RENDER
  renderExamScreen() {
    const q           = this.questions[this.currentQuestionIndex];
    const saved       = this.savedAnswers[q.id] || '';
    const flagged     = !!this.flaggedQuestions[q.id];
    const answered    = Object.keys(this.savedAnswers).length;
    const total       = this.questions.length;
    const violations  = window.ExamGuard ? window.ExamGuard.violationCount : 0;

    document.getElementById('main-content').innerHTML = `
      <div class="exam-shell">

        <!-- Exam Top Bar -->
        <div class="exam-topbar">
          <div class="exam-title-block">
            <div style="display:flex;gap:0.5rem;margin-bottom:0.25rem;">
              <span class="badge badge-cyan" style="font-size:0.68rem;">SESI AKTIF</span>
              <span class="badge badge-danger" style="font-size:0.68rem;">LOCKDOWN A</span>
            </div>
            <h3>${this.escHtml(this.currentQuiz.title)}</h3>
            <small>Kandidat: <b>${this.escHtml(this.currentUser.name)}</b> (${this.currentUser.nip_nis || this.currentUser.username}) — SMKN 1 CIBINONG</small>
          </div>

          <div class="exam-topbar-right">
            <!-- Camera HUD -->
            <div class="cam-hud">
              <div class="cam-screen">
                <div class="cam-scan-box"></div>
                <div class="cam-rec-dot"></div>
              </div>
              <div class="cam-meta">
                <span>PROCTOR FEED</span>
                <span style="color:var(--emerald);">● Biometric OK</span>
              </div>
            </div>

            <!-- Timer -->
            <div class="exam-timer">
              <div class="exam-timer-label">Sisa Waktu</div>
              <div class="exam-timer-value" id="exam-timer-display">--:--</div>
            </div>
          </div>
        </div>

        <!-- Violation Strip -->
        <div class="violation-strip">
          <span>⚠️</span>
          <span><b>ANTI-CHEAT AKTIF</b> — Berpindah tab akan dicatat. Pelanggaran: <b id="viol-count-display" style="color:#fca5a5;font-size:1rem;">${violations} / 3</b> (maks. 3x → diskualifikasi)</span>
        </div>

        <!-- Exam Body -->
        <div class="exam-body">

          <!-- Question Card -->
          <div class="question-card">
            <div class="question-meta">
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <span class="question-num">SOAL ${this.currentQuestionIndex + 1} / ${total}</span>
                <span class="badge badge-muted">Pilihan Ganda</span>
                <span class="badge badge-muted">10 Poin</span>
              </div>
              <button class="btn btn-sm ${flagged ? 'btn-danger' : 'btn-secondary'}" onclick="App.toggleFlag(${q.id})">
                ${flagged ? '★ Ditandai Ragu' : '☆ Tandai Ragu-ragu'}
              </button>
            </div>

            <div class="question-text">${this.escHtml(q.question_text)}</div>

            <div class="options-list">
              ${['A','B','C','D'].map(k => {
                const text  = q['option_' + k.toLowerCase()];
                const sel   = saved === k;
                return `
                  <div class="option-item ${sel ? 'selected' : ''}" onclick="App.selectOption(${q.id},'${k}')">
                    <div class="option-key">${k}</div>
                    <div class="option-text">${this.escHtml(text)}</div>
                    ${sel ? `<span class="badge badge-cyan" style="margin-left:auto;flex-shrink:0;">✓ Dipilih</span>` : ''}
                  </div>
                `;
              }).join('')}
            </div>

            <div class="question-nav-bar">
              <button class="btn btn-secondary" onclick="App.prevQ()" ${this.currentQuestionIndex === 0 ? 'disabled' : ''}>⬅️ Sebelumnya</button>
              <div style="display:flex;gap:0.6rem;align-items:center;">
                ${saved ? `<button class="btn btn-secondary btn-sm" onclick="App.clearChoice(${q.id})">🗑 Bersihkan</button>` : ''}
                ${this.currentQuestionIndex === total - 1
                  ? `<button class="btn btn-primary" onclick="App.confirmSubmit()">✅ Selesai & Kirim</button>`
                  : `<button class="btn btn-primary" onclick="App.nextQ()">Selanjutnya ➡️</button>`}
              </div>
            </div>
          </div>

          <!-- Navigation Palette -->
          <div class="nav-palette-card">
            <div class="palette-header">
              <div class="palette-title">🗂 Navigasi Soal</div>
              <span class="badge badge-cyan">${answered}/${total}</span>
            </div>
            <div class="palette-legend">
              <div style="display:flex;align-items:center;gap:0.3rem;"><div class="legend-dot" style="background:var(--cyan);"></div>Aktif</div>
              <div style="display:flex;align-items:center;gap:0.3rem;"><div class="legend-dot" style="background:var(--emerald);"></div>Dijawab</div>
              <div style="display:flex;align-items:center;gap:0.3rem;"><div class="legend-dot" style="background:var(--danger);"></div>Ragu</div>
              <div style="display:flex;align-items:center;gap:0.3rem;"><div class="legend-dot" style="background:var(--bg-input);border:1px solid var(--border-subtle);"></div>Belum</div>
            </div>
            <div class="palette-grid">
              ${this.questions.map((item, idx) => {
                const cls = [
                  idx === this.currentQuestionIndex ? 'active' : '',
                  this.savedAnswers[item.id]    ? 'answered' : '',
                  this.flaggedQuestions[item.id] ? 'flagged'  : '',
                ].filter(Boolean).join(' ');
                return `<div class="palette-num ${cls}" onclick="App.goToQ(${idx})">${idx + 1}${this.flaggedQuestions[item.id] ? '<span class="palette-flag-star">★</span>' : ''}</div>`;
              }).join('')}
            </div>
            <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border-subtle);">
              <button class="btn btn-primary btn-full" onclick="App.confirmSubmit()">✅ Selesaikan Ujian</button>
            </div>
          </div>

        </div>
      </div>
    `;

    this.updateTimerDisplay();
  },

  selectOption(qId, key) {
    this.savedAnswers[qId] = key;
    this.renderExamScreen();
    fetch('api/exam.php?action=save_answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt_id: this.attemptId, question_id: qId, selected_option: key }) });
  },

  clearChoice(qId) {
    delete this.savedAnswers[qId];
    this.renderExamScreen();
    fetch('api/exam.php?action=save_answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt_id: this.attemptId, question_id: qId, selected_option: '' }) });
  },

  toggleFlag(qId) {
    if (this.flaggedQuestions[qId]) delete this.flaggedQuestions[qId];
    else this.flaggedQuestions[qId] = true;
    this.renderExamScreen();
  },

  prevQ() { if (this.currentQuestionIndex > 0) { this.currentQuestionIndex--; this.renderExamScreen(); } },
  nextQ() { if (this.currentQuestionIndex < this.questions.length - 1) { this.currentQuestionIndex++; this.renderExamScreen(); } },
  goToQ(i) { this.currentQuestionIndex = i; this.renderExamScreen(); },

  startTimer(sec) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timeRemaining = sec;
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      this.updateTimerDisplay();
      if (this.timeRemaining <= 0) { clearInterval(this.timerInterval); alert('Waktu ujian habis!'); this.submitExam(true); }
    }, 1000);
  },

  updateTimerDisplay() {
    const el = document.getElementById('exam-timer-display');
    if (!el) return;
    const m = Math.floor(this.timeRemaining / 60);
    const s = this.timeRemaining % 60;
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    el.style.color = this.timeRemaining < 300 ? '#f87171' : '';
  },

  confirmSubmit() {
    const ans = Object.keys(this.savedAnswers).length;
    const tot = this.questions.length;
    this.openModal('✅ Kirim Jawaban Ujian?', `
      <div style="text-align:center;">
        <div style="font-size:3rem;margin-bottom:0.75rem;">📋</div>
        <p style="color:var(--text-sub);margin-bottom:1rem;font-size:0.92rem;">
          Anda telah menjawab <b style="color:var(--cyan);">${ans} dari ${tot}</b> soal.<br>
          Setelah dikirim, jawaban tidak dapat diubah.
        </p>
        <div style="display:flex;gap:0.5rem;justify-content:center;">
          <button class="btn btn-secondary" onclick="App.closeModal()">Periksa Kembali</button>
          <button class="btn btn-primary" onclick="App.closeModal();App.submitExam(false);">Ya, Kirim Sekarang</button>
        </div>
      </div>
    `);
  },

  submitExam(auto) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    window.ExamGuard.stop();
    fetch('api/exam.php?action=submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt_id: this.attemptId, quiz_id: this.currentQuiz.id }) })
      .then(r => r.json())
      .then(d => {
        this.setContent(`
          <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;">
            <div style="text-align:center;max-width:420px;">
              <div style="font-size:5rem;margin-bottom:1rem;">🎉</div>
              <h1 style="color:var(--cyan);font-size:1.8rem;margin-bottom:0.5rem;">Ujian Selesai!</h1>
              <p style="color:var(--text-sub);margin-bottom:1.25rem;">Jawaban Anda telah berhasil dikirim dan direkam oleh sistem.</p>
              <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-xl);padding:1.5rem 2rem;margin-bottom:1.5rem;">
                <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:0.25rem;">Skor Akhir Anda</div>
                <div style="font-family:var(--font-head);font-size:3.5rem;font-weight:800;color:var(--cyan);">${d.score || 0}</div>
                <div style="color:var(--text-muted);font-size:0.88rem;">dari 100</div>
              </div>
              <button class="btn btn-primary btn-lg" onclick="App.renderAppLayout('dashboard')">Kembali ke Dashboard</button>
            </div>
          </div>
        `);
      });
  },

  /* ────────────────────────────────────────────────────────────────────────────
     ATTENDANCE INPUT MODULE
  ──────────────────────────────────────────────────────────────────────────── */

  /* ────────────────────────────────────────────────────────────────────────────
     REKAP ABSENSI
  ──────────────────────────────────────────────────────────────────────────── */
  loadRekapAbsensi() {
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const currentYear = new Date().getFullYear();

    fetch('api/classes.php')
      .then(r => r.json())
      .then(d => {
        const classes = d.classes || [];
        const classOpts = classes.map(cl => `<option value="${cl.id}">${this.escHtml(cl.class_name)}</option>`).join('');
        const yearOpts  = [currentYear, currentYear-1, currentYear+1].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('');
        const monthOpts = months.map((m, i) => `<option value="${i+1}" ${i+1 === this.rekapMonth ? 'selected' : ''}>${m}</option>`).join('');

        this.setContent(`
          <div class="mb-3">
            <div class="section-title">📊 Rekap Absensi Siswa</div>
            <div class="section-sub">Laporan rekapitulasi kehadiran bulanan dan semesteran SMKN 1 CIBINONG.</div>
          </div>

          <!-- Print Header (hidden on screen) -->
          <div class="print-header">
            <h2>REKAPITULASI PRESENSI SISWA</h2>
            <h3>SMKN 1 CIBINONG — Tahun Ajaran 2026/2027</h3>
          </div>

          <!-- Filter & Mode Bar -->
          <div class="rekap-filter-bar">
            <!-- Mode Tabs -->
            <div class="filter-group">
              <span class="filter-label">Mode Rekap</span>
              <div class="rekap-mode-tabs">
                <div class="mode-tab ${this.rekapMode === 'monthly' ? 'active' : ''}" onclick="App.setRekapMode('monthly')">📅 Bulanan</div>
                <div class="mode-tab ${this.rekapMode === 'semester' ? 'active' : ''}" onclick="App.setRekapMode('semester')">📆 Semester</div>
              </div>
            </div>

            <!-- Kelas -->
            <div class="filter-group">
              <span class="filter-label">Kelas / Rombel</span>
              <select class="filter-select" id="rek-class">${classOpts}</select>
            </div>

            <!-- Monthly filters -->
            <div id="rekap-monthly-filters" class="${this.rekapMode === 'monthly' ? '' : 'hidden'}" style="display:contents;">
              <div class="filter-group">
                <span class="filter-label">Bulan</span>
                <select class="filter-select" id="rek-month">${monthOpts}</select>
              </div>
              <div class="filter-group">
                <span class="filter-label">Tahun</span>
                <select class="filter-select" id="rek-year">${yearOpts}</select>
              </div>
            </div>

            <!-- Semester filters -->
            <div id="rekap-semester-filters" class="${this.rekapMode === 'semester' ? '' : 'hidden'}" style="display:contents;">
              <div class="filter-group">
                <span class="filter-label">Semester</span>
                <select class="filter-select" id="rek-sem">
                  <option value="1">Ganjil (Jul–Jan)</option>
                  <option value="2">Genap (Feb–Jun)</option>
                </select>
              </div>
              <div class="filter-group">
                <span class="filter-label">Tahun Dimulai</span>
                <select class="filter-select" id="rek-sem-year">${yearOpts}</select>
              </div>
            </div>

            <div style="align-self:flex-end;">
              <button class="btn btn-primary" onclick="App.fetchRekap()">🔍 Tampilkan Rekap</button>
            </div>
          </div>

          <!-- Results Area -->
          <div id="rekap-results">
            <div class="card"><div class="empty-state"><div class="empty-icon">📊</div><p>Pilih filter dan klik "Tampilkan Rekap" untuk memuat data kehadiran.</p></div></div>
          </div>
        `);

        // Auto-load first class
        if (classes.length) {
          this.rekapClassId = classes[0].id;
          this.fetchRekap();
        }
      });
  },

  setRekapMode(mode) {
    this.rekapMode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase().includes(mode === 'monthly' ? 'bulanan' : 'semester')));
    document.getElementById('rekap-monthly-filters').classList.toggle('hidden', mode !== 'monthly');
    document.getElementById('rekap-semester-filters').classList.toggle('hidden', mode !== 'semester');
  },

  fetchRekap() {
    const classId = document.getElementById('rek-class')?.value || this.rekapClassId;
    let url = `api/rekap_attendance.php?class_id=${classId}&mode=${this.rekapMode}`;

    if (this.rekapMode === 'monthly') {
      const month = document.getElementById('rek-month')?.value || this.rekapMonth;
      const year  = document.getElementById('rek-year')?.value  || this.rekapYear;
      url += `&month=${month}&year=${year}`;
    } else {
      const sem  = document.getElementById('rek-sem')?.value      || 1;
      const year = document.getElementById('rek-sem-year')?.value || this.rekapYear;
      url += `&semester=${sem}&year=${year}`;
    }

    document.getElementById('rekap-results').innerHTML = `<div class="card"><div class="empty-state"><div class="boot-text">Memuat data rekap…</div></div></div>`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { document.getElementById('rekap-results').innerHTML = `<div class="card"><div class="empty-state"><p>${data.message}</p></div></div>`; return; }

        const s  = data.summary || {};
        const H  = parseInt(s.hadir  || 0);
        const I  = parseInt(s.izin   || 0);
        const S  = parseInt(s.sakit  || 0);
        const A  = parseInt(s.alpa   || 0);
        const Tt = parseInt(s.total  || 1);
        const pctGlobal = Tt > 0 ? Math.round((H / Tt) * 100) : 0;

        // Trend chart data
        const trend = data.trend || [];
        const chartLabels  = trend.map(t => t.label);
        const chartHadir   = trend.map(t => t.hadir);
        const chartIzin    = trend.map(t => t.izin);
        const chartSakit   = trend.map(t => t.sakit);
        const chartAlpa    = trend.map(t => t.alpa);

        // Table rows
        const rows = (data.rekap || []).map((r, i) => {
          const pct = r.pct_hadir;
          const pctClass = pct >= 85 ? 'att-pct-good' : pct >= 70 ? 'att-pct-ok' : 'att-pct-bad';
          return `
            <tr>
              <td class="td-mono">${i + 1}</td>
              <td class="td-main">${this.escHtml(r.name)}</td>
              <td class="td-mono">${r.nisn}</td>
              <td class="att-h">${r.hadir}</td>
              <td class="att-i">${r.izin}</td>
              <td class="att-s">${r.sakit}</td>
              <td class="att-a">${r.alpa}</td>
              <td><span class="badge ${r.terlambat > 0 ? 'badge-amber' : 'badge-muted'}">${r.terlambat}x</span></td>
              <td>
                <div class="pct-bar-wrap">
                  <div class="pct-bar"><div class="pct-bar-fill" style="width:${pct}%;background:${pct >= 85 ? 'var(--grad-green)' : pct >= 70 ? 'var(--grad-amber)' : 'var(--grad-danger)'};"></div></div>
                  <span class="${pctClass}">${pct}%</span>
                </div>
              </td>
            </tr>
          `;
        }).join('') || `<tr><td colspan="9"><div class="empty-state"><p>Tidak ada data untuk filter ini.</p></div></td></tr>`;

        document.getElementById('rekap-results').innerHTML = `
          <!-- KPI Summary -->
          <div class="rekap-summary-kpi">
            <div class="kpi-card">
              <div class="kpi-label text-muted">Kelas</div>
              <div class="kpi-value text-cyan" style="font-size:1.2rem;font-weight:800;">${this.escHtml(data.class_name)}</div>
              <div class="kpi-sub">${this.escHtml(data.label)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label" style="color:var(--emerald);">Total Hadir</div>
              <div class="kpi-value text-green">${H}</div>
              <div class="kpi-sub">Pertemuan hadir</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label" style="color:var(--blue);">Izin</div>
              <div class="kpi-value" style="color:var(--blue);">${I}</div>
              <div class="kpi-sub">Pertemuan izin</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label" style="color:var(--amber);">Sakit</div>
              <div class="kpi-value text-amber">${S}</div>
              <div class="kpi-sub">Pertemuan sakit</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label" style="color:var(--danger);">Alpa (Tanpa Ket.)</div>
              <div class="kpi-value text-danger">${A}</div>
              <div class="kpi-sub">Pertemuan alpa</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label text-muted">Kehadiran Global</div>
              <div class="kpi-value ${pctGlobal >= 85 ? 'text-green' : pctGlobal >= 70 ? 'text-amber' : 'text-danger'}">${pctGlobal}%</div>
              <div class="kpi-sub">Dari total ${Tt} pertemuan</div>
            </div>
          </div>

          <!-- Charts -->
          <div class="chart-row">
            <div class="chart-card">
              <div class="card-title" style="margin-bottom:0.75rem;">📊 Tren Kehadiran per Bulan</div>
              <canvas id="trend-chart" height="180"></canvas>
            </div>
            <div class="chart-card">
              <div class="card-title" style="margin-bottom:0.75rem;">🍩 Komposisi Kehadiran</div>
              <canvas id="donut-chart" height="180"></canvas>
            </div>
          </div>

          <!-- Export Buttons -->
          <div class="rekap-export-bar">
            <button class="btn btn-secondary" onclick="App.printRekap()">🖨️ Cetak PDF</button>
            <button class="btn btn-success" onclick="App.exportExcel()">📥 Export Excel (.xlsx)</button>
          </div>

          <!-- Data Table -->
          <div class="card">
            <div class="card-title" style="margin-bottom:0.75rem;">📋 Tabel Rekap Kehadiran Siswa</div>
            <div class="table-wrapper">
              <table class="data-table" id="rekap-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nama Siswa</th>
                    <th>NISN</th>
                    <th class="att-h">H</th>
                    <th class="att-i">I</th>
                    <th class="att-s">S</th>
                    <th class="att-a">A</th>
                    <th>Terlambat</th>
                    <th>% Hadir</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        `;

        // Render Charts
        this._renderRekapCharts(chartLabels, chartHadir, chartIzin, chartSakit, chartAlpa, H, I, S, A);
      });
  },

  _renderRekapCharts(labels, hadir, izin, sakit, alpa, sH, sI, sS, sA) {
    const isDark   = this.theme === 'dark';
    const gridClr  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickClr  = isDark ? '#94a8c0' : '#3d5a7a';

    // Destroy previous
    if (this._chartTrend) { this._chartTrend.destroy(); this._chartTrend = null; }
    if (this._chartDonut) { this._chartDonut.destroy(); this._chartDonut = null; }

    const trendCtx = document.getElementById('trend-chart');
    if (trendCtx && labels.length > 0) {
      this._chartTrend = new Chart(trendCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Hadir', data: hadir, backgroundColor: 'rgba(16,185,129,0.75)',  borderRadius: 4 },
            { label: 'Izin',  data: izin,  backgroundColor: 'rgba(56,189,248,0.75)',  borderRadius: 4 },
            { label: 'Sakit', data: sakit, backgroundColor: 'rgba(245,158,11,0.75)',  borderRadius: 4 },
            { label: 'Alpa',  data: alpa,  backgroundColor: 'rgba(239,68,68,0.75)',   borderRadius: 4 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: tickClr, font: { family: 'Inter', size: 11 } } } },
          scales: {
            x: { stacked: true, ticks: { color: tickClr }, grid: { color: gridClr } },
            y: { stacked: true, ticks: { color: tickClr }, grid: { color: gridClr } }
          }
        }
      });
    }

    const donutCtx = document.getElementById('donut-chart');
    if (donutCtx) {
      this._chartDonut = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: ['Hadir', 'Izin', 'Sakit', 'Alpa'],
          datasets: [{ data: [sH, sI, sS, sA], backgroundColor: ['rgba(16,185,129,0.8)','rgba(56,189,248,0.8)','rgba(245,158,11,0.8)','rgba(239,68,68,0.8)'], borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: { legend: { position: 'bottom', labels: { color: tickClr, font: { family: 'Inter', size: 11 }, padding: 12 } } }
        }
      });
    }
  },

  printRekap() { window.print(); },

  exportExcel() {
    if (typeof XLSX === 'undefined') { alert('Perpustakaan XLSX belum dimuat. Pastikan koneksi internet aktif.'); return; }
    const table = document.getElementById('rekap-table');
    if (!table) { alert('Tabel rekap tidak ditemukan.'); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    ws['!cols'] = [{ wch: 4 },{ wch: 30 },{ wch: 14 },{ wch: 6 },{ wch: 6 },{ wch: 6 },{ wch: 6 },{ wch: 10 },{ wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');
    const now = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `Rekap_Absensi_SMKN1_CIBINONG_${now}.xlsx`);
  },

  /* ────────────────────────────────────────────────────────────────────────────
     GRADES
  ──────────────────────────────────────────────────────────────────────────── */
  loadGrades() {
    const isSiswa = this.currentUser.role === 'siswa';
    fetch('api/grades.php')
      .then(r => r.json())
      .then(data => {
        const grades = data.grades || [];

        const rows = grades.length ? grades.map((g, i) => {
          const scoreColor = g.score >= 85 ? 'text-green' : g.score >= 70 ? 'text-amber' : 'text-danger';
          return `
            <tr>
              <td class="td-mono">${i + 1}</td>
              ${!isSiswa ? `<td class="td-main">${this.escHtml(g.student_name)}</td><td class="td-mono">${g.student_nis || '—'}</td>` : ''}
              <td class="td-main">${this.escHtml(g.quiz_title)}</td>
              <td><span class="font-mono font-800 ${scoreColor}" style="font-size:1.1rem;">${g.score}</span><span class="text-muted"> /100</span></td>
              <td><span class="badge ${g.score >= 70 ? 'badge-green' : 'badge-danger'}">${g.score >= 70 ? 'LULUS' : 'TIDAK LULUS'}</span></td>
              <td class="td-mono" style="font-size:0.78rem;">${g.finished_at ? g.finished_at.split(' ')[0] : '—'}</td>
            </tr>
          `;
        }).join('') : `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏆</div><p>Belum ada data nilai ujian.</p></div></td></tr>`;

        this.setContent(`
          <div class="mb-3">
            <div class="section-title">🏆 Daftar Nilai Ujian CBT</div>
            <div class="section-sub">Rekap nilai ujian CBT yang telah diselesaikan.</div>
          </div>
          <div class="card">
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    ${!isSiswa ? '<th>Nama Siswa</th><th>NIS</th>' : ''}
                    <th>Ujian</th>
                    <th>Skor</th>
                    <th>Keterangan</th>
                    <th>Tanggal Selesai</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        `);
      });
  },

  /* ────────────────────────────────────────────────────────────────────────────
     USER MANAGEMENT
  ──────────────────────────────────────────────────────────────────────────── */
  loadUsers() {
    if (this.currentUser.role === 'siswa') { this.renderAppLayout('dashboard'); return; }
    Promise.all([fetch('api/users.php').then(r => r.json()), fetch('api/classes.php').then(r => r.json())])
      .then(([ud, cd]) => {
        const users   = ud.users   || [];
        const classes = cd.classes || [];
        const roleMap = { admin: '🛡️ Admin', guru: '👨‍🏫 Guru', siswa: '🎓 Siswa' };

        const rows = users.map((u, i) => `
          <tr>
            <td class="td-mono">${i + 1}</td>
            <td>
              <div class="nav-avatar" style="width:30px;height:30px;font-size:0.72rem;display:inline-flex;margin-right:0.5rem;">${u.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>
              <span class="font-700">${this.escHtml(u.name)}</span>
            </td>
            <td class="td-mono">${this.escHtml(u.username)}</td>
            <td class="td-mono">${u.nip_nis || '—'}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-cyan' : u.role === 'guru' ? 'badge-blue' : 'badge-muted'}">${roleMap[u.role] || u.role}</span></td>
            <td>${u.class_name ? `<span class="badge badge-muted">${this.escHtml(u.class_name)}</span>` : '—'}</td>
            <td>
              ${u.username !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="App.deleteUser(${u.id})">🗑️</button>` : '<span class="text-muted">—</span>'}
            </td>
          </tr>
        `).join('');

        const classOpts = classes.map(cl => `<option value="${cl.id}">${this.escHtml(cl.class_name)}</option>`).join('');

        this.setContent(`
          <div class="flex-between mb-3">
            <div>
              <div class="section-title">👥 Manajemen Pengguna</div>
              <div class="section-sub">Kelola akun Siswa, Guru, dan Administrator SMKN 1 CIBINONG.</div>
            </div>
            <button class="btn btn-primary" onclick="App.openAddUserModal()">➕ Tambah Pengguna</button>
          </div>

          <div class="card">
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>#</th><th>Nama</th><th>Username</th><th>NIP / NIS</th><th>Role</th><th>Kelas</th><th>Hapus</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        `);
        this._classOpts = classOpts;
      });
  },

  openAddUserModal() {
    this.openModal('Tambah Pengguna Baru', `
      <form onsubmit="App.handleAddUser(event)">
        <div class="form-group mb-2"><label class="form-label">Nama Lengkap</label><input type="text" id="u-name" class="form-control" required placeholder="cth: Ahmad Fadhillah"></div>
        <div class="form-group mb-2"><label class="form-label">Username</label><input type="text" id="u-user" class="form-control" required placeholder="cth: siswa1"></div>
        <div class="form-group mb-2"><label class="form-label">NIP / NISN</label><input type="text" id="u-nis" class="form-control" placeholder="cth: 0089712345"></div>
        <div class="form-group mb-2">
          <label class="form-label">Role</label>
          <select id="u-role" class="form-control" onchange="App.toggleClassField()">
            <option value="siswa">🎓 Siswa</option>
            <option value="guru">👨‍🏫 Guru</option>
            <option value="admin">🛡️ Admin</option>
          </select>
        </div>
        <div class="form-group mb-2" id="u-class-group">
          <label class="form-label">Kelas (Siswa)</label>
          <select id="u-class" class="form-control">${this._classOpts || ''}</select>
        </div>
        <div class="form-group mb-3"><label class="form-label">Password</label><input type="password" id="u-pass" class="form-control" required placeholder="Minimal 6 karakter"></div>
        <div class="flex-end flex-gap-1"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Batal</button><button type="submit" class="btn btn-primary">Simpan Pengguna</button></div>
      </form>
    `);
  },

  toggleClassField() {
    const role = document.getElementById('u-role')?.value;
    const grp  = document.getElementById('u-class-group');
    if (grp) grp.style.display = role === 'siswa' ? '' : 'none';
  },

  handleAddUser(e) {
    e.preventDefault();
    const role     = document.getElementById('u-role').value;
    const classId  = role === 'siswa' ? document.getElementById('u-class').value : null;
    fetch('api/users.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', name: document.getElementById('u-name').value, username: document.getElementById('u-user').value, nip_nis: document.getElementById('u-nis').value, role, class_id: classId, password: document.getElementById('u-pass').value }) })
      .then(r => r.json()).then(d => { if (d.success) { this.closeModal(); this.loadUsers(); } else alert(d.message); });
  },

  deleteUser(id) {
    if (!confirm('Hapus pengguna ini?')) return;
    fetch('api/users.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', user_id: id }) }).then(() => this.loadUsers());
  },

  /* ────────────────────────────────────────────────────────────────────────────
     MODAL HELPERS
  ──────────────────────────────────────────────────────────────────────────── */
  openModal(title, body, extraClass = 'modal-box') {
    let existing = document.getElementById('global-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'global-modal';
    backdrop.innerHTML = `
      <div class="${extraClass}">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close" onclick="App.closeModal()">×</button>
        </div>
        ${body}
      </div>
    `;
    backdrop.addEventListener('click', e => { if (e.target === backdrop) this.closeModal(); });
    document.body.appendChild(backdrop);
  },

  closeModal() {
    document.getElementById('global-modal')?.remove();
  },

  /* ────────────────────────────────────────────────────────────────────────────
     ANNOUNCEMENTS MODULE (Full CRUD)
  ──────────────────────────────────────────────────────────────────────────── */
  _annFilterTarget: 'all',

  loadAnnouncements() {
    const isStaff = ['admin', 'guru'].includes(this.currentUser?.role);
    this.setContent(`
      <div class="flex-between mb-3">
        <div>
          <div class="section-title">📢 Pengumuman & Informasi Sekolah</div>
          <div class="section-sub">Papan informasi dan pengumuman resmi SMKN 1 CIBINONG.</div>
        </div>
        ${isStaff ? `<button class="btn btn-primary" onclick="App.showAnnForm()">➕ Buat Pengumuman</button>` : ''}
      </div>

      <div class="card mb-3" style="padding:1rem;">
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
          <div style="display:flex;gap:0.35rem;">
            <button class="btn btn-sm ${this._annFilterTarget === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="App.filterAnnouncements('all')">🌐 Semua Target</button>
            <button class="btn btn-sm ${this._annFilterTarget === 'siswa' ? 'btn-primary' : 'btn-secondary'}" onclick="App.filterAnnouncements('siswa')">🎓 Siswa</button>
            <button class="btn btn-sm ${this._annFilterTarget === 'guru' ? 'btn-primary' : 'btn-secondary'}" onclick="App.filterAnnouncements('guru')">👨‍🏫 Guru</button>
          </div>
        </div>
      </div>

      <div id="ann-list" class="cards-grid">
        <div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">⏳</div><p>${this.t('loading')}</p></div>
      </div>
    `);
    this._refreshAnnList();
  },

  filterAnnouncements(target) {
    this._annFilterTarget = target;
    this.loadAnnouncements();
  },

  _refreshAnnList() {
    fetch('api/announcements.php')
      .then(r => r.json())
      .then(res => {
        const el = document.getElementById('ann-list');
        if (!el) return;
        let items = res.data || res.announcements || [];

        if (this._annFilterTarget && this._annFilterTarget !== 'all') {
          items = items.filter(a => a.target === 'all' || a.target === this._annFilterTarget);
        }

        const isStaff = ['admin', 'guru'].includes(this.currentUser?.role);
        if (!items.length) {
          el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📢</div><p>Belum ada pengumuman terdaftar.</p></div>`;
          return;
        }

        el.innerHTML = items.map(a => `
          <div class="card" style="position:relative; ${a.is_pinned ? 'border-left: 4px solid var(--amber);' : ''}">
            <div class="flex-between mb-2">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                ${a.is_pinned ? '<span class="badge badge-amber">📌 Disematkan</span>' : ''}
                <span class="badge badge-${a.target === 'siswa' ? 'cyan' : a.target === 'guru' ? 'amber' : 'blue'}">
                  🎯 Target: ${a.target === 'all' ? 'Semua' : (a.target === 'siswa' ? 'Siswa' : 'Guru')}
                </span>
              </div>
              ${isStaff ? `
                <div style="display:flex;gap:0.35rem;">
                  <button class="btn btn-secondary btn-sm" onclick='App.showAnnForm(${JSON.stringify(a).replace(/'/g, "&#39;")})' title="Edit Pengumuman">✏️ Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="App.deleteAnn(${a.id})" title="Hapus Pengumuman">🗑️ Hapus</button>
                </div>
              ` : ''}
            </div>
            <h3 style="font-size:1.1rem;margin:0.25rem 0 0.5rem;color:var(--text-main);">${this.escHtml(a.title)}</h3>
            <p style="font-size:0.88rem;color:var(--text-sub);line-height:1.65;white-space:pre-line;margin-bottom:1rem;">${this.escHtml(a.content)}</p>
            <div style="font-size:0.78rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:0.6rem;display:flex;justify-content:space-between;">
              <span>✍️ Oleh: <b>${this.escHtml(a.author_name)}</b></span>
              <span>📅 ${new Date(a.created_at).toLocaleString('id-ID', {dateStyle:'medium', timeStyle:'short'})}</span>
            </div>
          </div>
        `).join('');
      });
  },

  showAnnForm(existing) {
    const isEdit = !!existing;
    this.openModal(isEdit ? 'Edit Pengumuman' : 'Buat Pengumuman Baru', `
      <form onsubmit="App.saveAnn(event, ${existing?.id || 'null'})">
        <div class="form-group mb-2">
          <label class="form-label">Judul Pengumuman *</label>
          <input class="form-control" id="ann-title" value="${this.escHtml(existing?.title || '')}" placeholder="Masukkan judul pengumuman" required>
        </div>
        <div class="form-group mb-2">
          <label class="form-label">Isi Pengumuman *</label>
          <textarea class="form-control" id="ann-content" rows="6" placeholder="Tuliskan isi pengumuman lengkap..." required>${this.escHtml(existing?.content || '')}</textarea>
        </div>
        <div class="grid-2col mb-3" style="gap:1rem;">
          <div class="form-group">
            <label class="form-label">Target Penerima</label>
            <select class="form-control" id="ann-target">
              <option value="all" ${(existing?.target || 'all') === 'all' ? 'selected' : ''}>Semua (Siswa & Guru)</option>
              <option value="siswa" ${existing?.target === 'siswa' ? 'selected' : ''}>Khusus Siswa</option>
              <option value="guru" ${existing?.target === 'guru' ? 'selected' : ''}>Khusus Guru</option>
            </select>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:0.5rem;padding-top:1.5rem;">
            <input type="checkbox" id="ann-pinned" ${existing?.is_pinned ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
            <label for="ann-pinned" class="form-label" style="margin:0;cursor:pointer;">📌 Sematkan Pengumuman (Pin to top)</label>
          </div>
        </div>
        <div class="flex-end flex-gap-1">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">${this.t('cancel')}</button>
          <button type="submit" class="btn btn-primary">Simpan Pengumuman</button>
        </div>
      </form>
    `);
  },

  saveAnn(e, id) {
    if (e && e.preventDefault) e.preventDefault();
    const title   = document.getElementById('ann-title')?.value?.trim();
    const content = document.getElementById('ann-content')?.value?.trim();
    const target  = document.getElementById('ann-target')?.value || 'all';
    const pinned  = document.getElementById('ann-pinned')?.checked ? 1 : 0;
    if (!title || !content) { alert('Judul dan isi pengumuman wajib diisi.'); return; }

    const method  = id ? 'PUT' : 'POST';
    const payload = { title, content, target, is_pinned: pinned, ...(id ? { id } : {}) };

    fetch('api/announcements.php', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          this.closeModal();
          this._refreshAnnList();
          this._toast(id ? '✅ Pengumuman diperbarui.' : '✅ Pengumuman baru dipublikasikan!');
        } else alert(res.message || 'Gagal menyimpan.');
      });
  },

  deleteAnn(id) {
    if (!confirm('Hapus pengumuman ini?')) return;
    fetch('api/announcements.php', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          this._refreshAnnList();
          this._toast('✅ Pengumuman dihapus.');
        } else alert(res.message);
      });
  },

  /* ────────────────────────────────────────────────────────────────────────────
     GRADES MODULE (Weighted + CSV Export)
  ──────────────────────────────────────────────────────────────────────────── */
  loadGradesModule() {
    const u = this.currentUser;
    const isStaff = ['admin','guru'].includes(u?.role);

    if (!isStaff) {
      // Student: show own grades
      this.setContent(`
        <div class="hero-banner" style="padding:1.5rem 2rem;margin-bottom:1.5rem;">
          <div><div class="hero-badge">🏆 Penilaian Akademik</div>
            <div class="hero-title" style="font-size:1.4rem;">Daftar Nilai Saya</div>
            <div class="hero-sub">Bobot: Tugas 30% · UTS 20% · UAS/CBT 30% · Kehadiran 20%</div>
          </div>
        </div>
        <div id="grades-content" class="card">
          <div class="empty-state"><div class="empty-icon">⏳</div><p>${this.t('loading')}</p></div>
        </div>
      `);
      fetch('api/grades.php?action=list&semester=1')
        .then(r => r.json())
        .then(res => {
          const el = document.getElementById('grades-content');
          if (!el) return;
          const rows = res.data || [];
          if (!rows.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Belum ada nilai.</p></div>`; return; }
          el.innerHTML = `
            <table class="table" style="width:100%;">
              <thead><tr>
                <th>Mata Pelajaran</th>
                <th style="text-align:center;">Tugas</th>
                <th style="text-align:center;">UTS</th>
                <th style="text-align:center;">UAS/CBT</th>
                <th style="text-align:center;">Kehadiran</th>
                <th style="text-align:center;">Nilai Akhir</th>
                <th style="text-align:center;">Predikat</th>
              </tr></thead>
              <tbody>${rows.map(r => `
                <tr>
                  <td>${r.icon || '📚'} ${this.escHtml(r.course_name)}</td>
                  <td style="text-align:center;">${r.nilai_tugas ?? '–'}</td>
                  <td style="text-align:center;">${r.nilai_uts ?? '–'}</td>
                  <td style="text-align:center;">${r.nilai_uas ?? '–'}</td>
                  <td style="text-align:center;">${r.nilai_hadir ?? '–'}</td>
                  <td style="text-align:center;font-weight:700;color:var(--accent);">${r.nilai_akhir ?? '–'}</td>
                  <td style="text-align:center;"><span class="badge badge-${r.predikat === 'A' ? 'cyan' : r.predikat === 'B' ? 'blue' : r.predikat === 'C' ? 'amber' : 'danger'}">${r.predikat || '–'}</span></td>
                </tr>`).join('')}
              </tbody>
            </table>
          `;
        });
      return;
    }

    // Staff: class + course picker + table
    this.setContent(`
      <div class="hero-banner" style="padding:1.5rem 2rem;margin-bottom:1.5rem;">
        <div><div class="hero-badge">🏆 Penilaian Akademik</div>
          <div class="hero-title" style="font-size:1.4rem;">Manajemen Daftar Nilai</div>
          <div class="hero-sub">Bobot: Tugas 30% · UTS 20% · UAS/CBT 30% · Kehadiran 20%</div>
        </div>
        <button class="btn btn-outline" style="margin-left:auto;" onclick="App.exportGradesCSV()">📥 ${this.t('export_csv')}</button>
      </div>
      <div class="card" style="margin-bottom:1rem;">
        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="margin:0;min-width:180px;">
            <label class="form-label">Kelas</label>
            <select class="form-control" id="grades-class-filter" onchange="App.loadGradeTable()"><option value="0">Semua Kelas</option></select>
          </div>
          <div class="form-group" style="margin:0;min-width:200px;">
            <label class="form-label">Mata Pelajaran</label>
            <select class="form-control" id="grades-course-filter" onchange="App.loadGradeTable()"><option value="0">Semua Mapel</option></select>
          </div>
          <div class="form-group" style="margin:0;min-width:120px;">
            <label class="form-label">Semester</label>
            <select class="form-control" id="grades-sem-filter" onchange="App.loadGradeTable()">
              <option value="1" selected>Ganjil (1)</option>
              <option value="2">Genap (2)</option>
            </select>
          </div>
        </div>
      </div>
      <div id="grades-table-area" class="card">
        <div class="empty-state"><div class="empty-icon">⏳</div><p>Pilih kelas untuk memuat nilai.</p></div>
      </div>
    `);

    // Populate selects
    fetch('api/classes.php').then(r => r.json()).then(res => {
      const sel = document.getElementById('grades-class-filter');
      if (!sel) return;
      (res.data || []).forEach(c => sel.add(new Option(c.class_name, c.id)));
    });
    fetch('api/courses.php').then(r => r.json()).then(res => {
      const sel = document.getElementById('grades-course-filter');
      if (!sel) return;
      (res.data || []).forEach(c => sel.add(new Option(c.course_name, c.id)));
    });
  },

  loadGradeTable() {
    const classId  = document.getElementById('grades-class-filter')?.value || 0;
    const courseId = document.getElementById('grades-course-filter')?.value || 0;
    const semester = document.getElementById('grades-sem-filter')?.value || 1;
    const area     = document.getElementById('grades-table-area');
    if (!area) return;
    area.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>${this.t('loading')}</p></div>`;
    fetch(`api/grades.php?action=list&class_id=${classId}&course_id=${courseId}&semester=${semester}`)
      .then(r => r.json())
      .then(res => {
        const rows = res.data || [];
        if (!rows.length) { area.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>${this.t('no_data')}</p></div>`; return; }
        area.innerHTML = `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%;min-width:800px;">
              <thead><tr>
                <th>Nama Siswa</th><th>NIS</th><th>Kelas</th><th>Mapel</th>
                <th style="text-align:center;">Tugas</th><th style="text-align:center;">UTS</th>
                <th style="text-align:center;">UAS</th><th style="text-align:center;">Kehadiran</th>
                <th style="text-align:center;">Nilai Akhir</th><th style="text-align:center;">Predikat</th>
                <th>Aksi</th>
              </tr></thead>
              <tbody>${rows.map(r => `
                <tr>
                  <td style="font-weight:600;">${this.escHtml(r.student_name)}</td>
                  <td style="color:var(--text-muted);font-size:0.82rem;">${this.escHtml(r.nip_nis || '–')}</td>
                  <td>${this.escHtml(r.class_name || '–')}</td>
                  <td>${this.escHtml(r.course_name)}</td>
                  <td style="text-align:center;">${r.nilai_tugas ?? '–'}</td>
                  <td style="text-align:center;">${r.nilai_uts ?? '–'}</td>
                  <td style="text-align:center;">${r.nilai_uas ?? '–'}</td>
                  <td style="text-align:center;">${r.nilai_hadir ?? '–'}</td>
                  <td style="text-align:center;font-weight:700;color:var(--accent);">${r.nilai_akhir ?? '–'}</td>
                  <td style="text-align:center;"><span class="badge badge-${r.predikat === 'A' ? 'cyan' : r.predikat === 'B' ? 'blue' : r.predikat === 'C' ? 'amber' : 'danger'}">${r.predikat || '–'}</span></td>
                  <td><button class="btn btn-outline" style="font-size:0.75rem;padding:0.25rem 0.6rem;" onclick="App.editGrade(${JSON.stringify(r)})">✏️</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        `;
      });
  },

  editGrade(row) {
    this.showModal(`Edit Nilai — ${row.student_name}`, `
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;">Mapel: <b>${row.course_name}</b> · Bobot: Tugas 30% | UTS 20% | UAS 30% | Kehadiran 20%</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div class="form-group"><label class="form-label">${this.t('nilai_tugas')}</label>
          <input class="form-control" id="eg-tugas" type="number" min="0" max="100" value="${row.nilai_tugas ?? ''}" placeholder="0–100"></div>
        <div class="form-group"><label class="form-label">${this.t('nilai_uts')}</label>
          <input class="form-control" id="eg-uts"   type="number" min="0" max="100" value="${row.nilai_uts ?? ''}" placeholder="0–100"></div>
        <div class="form-group"><label class="form-label">${this.t('nilai_uas')}</label>
          <input class="form-control" id="eg-uas"   type="number" min="0" max="100" value="${row.nilai_uas ?? ''}" placeholder="0–100"></div>
        <div class="form-group"><label class="form-label">${this.t('nilai_hadir')}</label>
          <input class="form-control" id="eg-hadir" type="number" min="0" max="100" value="${row.nilai_hadir ?? ''}" placeholder="0–100"></div>
      </div>
      <div id="eg-preview" style="background:var(--accent-dim);border-radius:var(--r-md);padding:0.75rem;margin:0.5rem 0;font-size:0.88rem;color:var(--text-main);">Nilai akhir akan dihitung otomatis.</div>
      <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">
        <button class="btn btn-outline" onclick="App.closeModal()">${this.t('cancel')}</button>
        <button class="btn btn-primary" onclick="App.saveGrade(${row.student_id},${row.course_id},${row.semester||1})">${this.t('save')}</button>
      </div>
    `);
    ['eg-tugas','eg-uts','eg-uas','eg-hadir'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
      const t = parseFloat(document.getElementById('eg-tugas').value) || 0;
      const u = parseFloat(document.getElementById('eg-uts').value)   || 0;
      const a = parseFloat(document.getElementById('eg-uas').value)   || 0;
      const h = parseFloat(document.getElementById('eg-hadir').value) || 0;
      const na = (t*0.3 + u*0.2 + a*0.3 + h*0.2).toFixed(1);
      const pr = na >= 90 ? 'A' : na >= 80 ? 'B' : na >= 70 ? 'C' : 'D';
      const pv = document.getElementById('eg-preview');
      if (pv) pv.innerHTML = `Nilai Akhir: <b style="color:var(--accent);font-size:1rem;">${na}</b> &nbsp; Predikat: <span class="badge badge-cyan">${pr}</span>`;
    }));
  },

  saveGrade(studentId, courseId, semester) {
    const payload = {
      student_id: studentId, course_id: courseId, semester,
      nilai_tugas: parseFloat(document.getElementById('eg-tugas').value) || null,
      nilai_uts:   parseFloat(document.getElementById('eg-uts').value)   || null,
      nilai_uas:   parseFloat(document.getElementById('eg-uas').value)   || null,
      nilai_hadir: parseFloat(document.getElementById('eg-hadir').value) || null,
    };
    fetch('api/grades.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      .then(r => r.json())
      .then(res => {
        if (res.success) { this.closeModal(); this.loadGradeTable(); }
        else alert(res.message || 'Gagal menyimpan nilai.');
      });
  },

  exportGradesCSV() {
    const classId  = document.getElementById('grades-class-filter')?.value || 0;
    const courseId = document.getElementById('grades-course-filter')?.value || 0;
    const semester = document.getElementById('grades-sem-filter')?.value || 1;
    fetch(`api/grades.php?action=export&class_id=${classId}&course_id=${courseId}&semester=${semester}`)
      .then(r => r.text())
      .then(csv => {
        const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `nilai_smkn1cibinong_sem${semester}.csv`;
        a.click();
      });
  },

  /* ────────────────────────────────────────────────────────────────────────────
     ATTENDANCE INPUT (Bulk + Mark All Present + Robust Class/Course Loading)
  ──────────────────────────────────────────────────────────────────────────── */
  _attState: { classId: 0, courseId: 0, date: '' },
  _attStudents: [],

  loadAttendanceInput() {
    if (this.currentUser && this.currentUser.role === 'siswa') {
      this.renderAppLayout('rekap');
      return;
    }

    this.setContent(`
      <div class="hero-banner" style="padding:1.5rem 2rem;margin-bottom:1.5rem;">
        <div>
          <div class="hero-badge">📋 Presensi Harian</div>
          <div class="hero-title" style="font-size:1.4rem;">Input Presensi Siswa</div>
          <div class="hero-sub">Isi & simpan daftar hadir siswa per kelas, per tanggal, dan per mata pelajaran.</div>
        </div>
      </div>

      <div class="card mb-3" style="margin-bottom:1rem;">
        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="margin:0;min-width:180px;">
            <label class="form-label" style="font-weight:700;">Kelas *</label>
            <select class="form-control filter-select" id="att-class" onchange="App.loadAttList()"><option value="0">Memuat Kelas…</option></select>
          </div>
          <div class="form-group" style="margin:0;min-width:200px;">
            <label class="form-label" style="font-weight:700;">Mata Pelajaran</label>
            <select class="form-control filter-select" id="att-course" onchange="App.loadAttList()"><option value="0">— Semua Mapel —</option></select>
          </div>
          <div class="form-group" style="margin:0;min-width:160px;">
            <label class="form-label" style="font-weight:700;">Tanggal *</label>
            <input type="date" class="form-control filter-select" id="att-date" value="${new Date().toISOString().split('T')[0]}" onchange="App.loadAttList()">
          </div>
          <button class="btn btn-outline" style="padding:0.55rem 1rem;" onclick="App.markAllPresent()">✅ ${this.t('mark_all_present')}</button>
          <button class="btn btn-primary" style="padding:0.55rem 1rem;" onclick="App.saveAttBulk()">💾 Simpan Presensi</button>
        </div>
      </div>

      <div id="att-list-area" class="card">
        <div class="empty-state"><div class="empty-icon">📋</div><p>Memuat daftar kelas...</p></div>
      </div>
    `);

    // Fetch classes and courses simultaneously
    Promise.all([
      fetch('api/classes.php').then(r => r.json()).catch(() => ({})),
      fetch('api/courses.php').then(r => r.json()).catch(() => ({}))
    ]).then(([resClasses, resCourses]) => {
      const selClass  = document.getElementById('att-class');
      const selCourse = document.getElementById('att-course');

      const classes = resClasses.classes || resClasses.data || [];
      const courses = resCourses.courses || resCourses.data || [];

      if (selClass) {
        if (!classes.length) {
          selClass.innerHTML = `<option value="0">Belum Ada Data Kelas</option>`;
        } else {
          selClass.innerHTML = classes.map(c => `<option value="${c.id}">${this.escHtml(c.class_name || c.name)}</option>`).join('');
        }
      }

      if (selCourse) {
        selCourse.innerHTML = `<option value="0">— Semua Mapel —</option>` +
          courses.map(c => `<option value="${c.id}">${this.escHtml(c.course_name || c.name)}</option>`).join('');
      }

      if (classes.length > 0) {
        this.loadAttList();
      } else {
        const area = document.getElementById('att-list-area');
        if (area) area.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Belum ada data kelas terdaftar.</p></div>`;
      }
    });
  },

  loadAttList() {
    const classId  = document.getElementById('att-class')?.value || 0;
    const courseId = document.getElementById('att-course')?.value || 0;
    const date     = document.getElementById('att-date')?.value || new Date().toISOString().split('T')[0];
    this._attState = { classId, courseId, date };

    if (!classId || classId == 0) return;
    const area = document.getElementById('att-list-area');
    if (area) area.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>${this.t('loading')}</p></div>`;

    fetch(`api/attendance.php?action=list&class_id=${classId}&course_id=${courseId}&date=${date}`)
      .then(r => r.json())
      .then(res => {
        if (!area) return;
        const students = res.data || res.students || [];
        if (!students.length) {
          area.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>Tidak ada siswa di kelas ini.</p></div>`;
          return;
        }

        const statusOpts = ['hadir','izin','sakit','alpa'];
        area.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
            <div style="font-weight:700;font-size:0.95rem;color:var(--text-main);">Daftar Hadir Siswa — Total ${students.length} Siswa</div>
            <span class="badge badge-cyan">Tanggal: ${date}</span>
          </div>
          <div class="table-responsive" style="overflow-x:auto;">
            <table class="data-table att-input-table" style="width:100%;">
              <thead>
                <tr>
                  <th style="width:40px;">#</th>
                  <th>Nama Siswa</th>
                  <th>NIS / Username</th>
                  <th style="text-align:center;width:140px;">Status Presensi</th>
                  <th style="text-align:center;width:100px;">Terlambat</th>
                  <th>Catatan / Keterangan</th>
                </tr>
              </thead>
              <tbody>
                ${students.map((s, i) => {
                  const sid = s.student_id || s.id;
                  const cur = s.status || 'hadir';
                  return `
                    <tr>
                      <td style="color:var(--text-muted);font-weight:700;">${i + 1}</td>
                      <td style="font-weight:700;color:var(--text-main);">${this.escHtml(s.name)}</td>
                      <td style="color:var(--text-muted);font-size:0.82rem;" class="font-mono">${this.escHtml(s.nip_nis || s.username || '–')}</td>
                      <td style="text-align:center;">
                        <select class="form-control" id="att-status-${sid}" style="min-width:110px;font-size:0.83rem;padding:0.35rem 0.6rem;font-weight:600;">
                          ${statusOpts.map(st => `<option value="${st}" ${cur === st ? 'selected' : ''}>${st.charAt(0).toUpperCase() + st.slice(1)}</option>`).join('')}
                        </select>
                      </td>
                      <td style="text-align:center;">
                        <input type="checkbox" id="att-late-${sid}" ${s.is_late ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
                      </td>
                      <td>
                        <input type="text" class="form-control" id="att-notes-${sid}" value="${this.escHtml(s.notes || '')}" placeholder="Keterangan opsional" style="font-size:0.82rem;padding:0.35rem 0.6rem;">
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
        this._attStudents = students.map(s => s.student_id || s.id);
      })
      .catch(() => {
        if (area) area.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat data presensi.</p></div>`;
      });
  },

  markAllPresent() {
    const { classId, courseId, date } = this._attState;
    if (!classId || classId == 0) { alert('Pilih kelas terlebih dahulu.'); return; }
    fetch('api/attendance.php', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ class_id: classId, course_id: courseId || null, date, mark_all_present: true })
    }).then(r => r.json())
      .then(res => {
        if (res.success) {
          this.loadAttList();
          this._toast(`✅ ${res.marked} siswa ditandai hadir.`);
        } else alert(res.message);
      });
  },

  saveAttBulk() {
    const { classId, courseId, date } = this._attState;
    if (!classId || classId == 0) { alert('Pilih kelas terlebih dahulu.'); return; }
    const records = this._attStudents.map(sid => ({
      student_id: sid,
      status: document.getElementById(`att-status-${sid}`)?.value || 'hadir',
      is_late: document.getElementById(`att-late-${sid}`)?.checked ? 1 : 0,
      notes:   document.getElementById(`att-notes-${sid}`)?.value || ''
    }));
    fetch('api/attendance.php', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ class_id: classId, course_id: courseId || null, date, records })
    }).then(r => r.json())
      .then(res => {
        if (res.success) this._toast(`✅ Presensi ${res.saved} siswa berhasil disimpan.`);
        else alert(res.message);
      });
  },

  /* ────────────────────────────────────────────────────────────────────────────
     ADMIN: RESET EXAM ATTEMPT
  ──────────────────────────────────────────────────────────────────────────── */
  adminResetExam(userId, quizId, studentName) {
    if (!confirm(`Reset ujian untuk ${studentName}? Semua jawaban akan dihapus dan siswa dapat mengerjakan ulang.`)) return;
    fetch(`api/quizzes.php?action=reset_attempt&user_id=${userId}&quiz_id=${quizId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) this._toast(`✅ Ujian ${studentName} berhasil direset.`);
        else alert(res.message || 'Gagal reset.');
      });
  },

  /* ────────────────────────────────────────────────────────────────────────────
     TOAST NOTIFICATION
  ──────────────────────────────────────────────────────────────────────────── */
  _toast(msg, type = 'success') {
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'app-toast';
    t.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:0.85rem 1.4rem;
      background:${type === 'success' ? 'var(--emerald)' : 'var(--danger)'};
      color:#fff;border-radius:var(--r-lg);font-size:0.88rem;font-weight:600;
      box-shadow:0 6px 24px rgba(0,0,0,0.25);animation:fadeInUp 0.3s ease;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  },

  /* ────────────────────────────────────────────────────────────────────────────
     UTILITIES
  ──────────────────────────────────────────────────────────────────────────── */
  escHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};

/* ══════════════════════════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => App.init());

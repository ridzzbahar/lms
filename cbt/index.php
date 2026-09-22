<?php
// cbt/index.php — E-Learning SMKN 1 CIBINONG
session_start();
?>
<!DOCTYPE html>
<html lang="id" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="E-Learning SMKN 1 CIBINONG — Portal Akademik & CBT Online Terintegrasi.">
  <meta name="author" content="SMKN 1 CIBINONG">
  <title>E-Learning SMKN 1 CIBINONG</title>

  <!-- Google Fonts: Space Grotesk + Inter + JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">

  <!-- Chart.js CDN (lightweight, no build needed) -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>

  <!-- SheetJS for Excel export -->
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

  <!-- App Stylesheet -->
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

  <!-- ═══════════════════════════════════════════════════════════════════════════
       TOP NAVIGATION BAR
  ════════════════════════════════════════════════════════════════════════════ -->
  <nav class="navbar" id="main-navbar">
    <div class="navbar-left">
      <!-- Hamburger (Mobile) -->
      <button class="hamburger-btn" id="hamburger-btn" onclick="App.toggleSidebar()" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>

      <!-- Logo + Brand -->
      <div class="brand">
        <img class="brand-logo" src="images/logo.png" alt="Logo SMKN 1 CIBINONG" onerror="this.onerror=null; this.src='images/logo.jpg';">
        <div class="brand-text">
          <span class="brand-name">E-Learning SMKN 1 CIBINONG</span>
          <span class="brand-sub">Portal Akademik Terpadu</span>
        </div>
      </div>
    </div>

    <!-- Center: Guard Status -->
    <div class="navbar-center" id="navbar-center-status">
      <div class="guard-pill">
        <span class="pulse-dot"></span>
        <span>Lockdown Guard: Active</span>
      </div>
      <div class="nav-clock">
        <span id="nav-clock-display">--:--:--</span>
        <span class="nav-tz">WIB</span>
      </div>
    </div>

    <!-- Right: User Area -->
    <div class="navbar-right">
      <button class="lang-btn" id="lang-btn" onclick="App.toggleLang()" title="Switch Language" style="font-weight: 700; font-size: 0.85rem; color: var(--text-main); margin-right: 0.5rem; background: none; border: none; cursor: pointer;">
        <span id="lang-text">ID</span>
      </button>
      <button class="theme-btn" id="theme-btn" onclick="App.toggleTheme()" title="Ganti Tema">
        <span id="theme-icon">🌙</span>
      </button>
      <div id="navbar-user-area"></div>
    </div>
  </nav>

  <!-- Sidebar Overlay (mobile) -->
  <div class="sidebar-overlay" id="sidebar-overlay" onclick="App.closeSidebar()"></div>

  <!-- ═══════════════════════════════════════════════════════════════════════════
       APP LAYOUT WRAPPER (Sidebar + Main Content)
  ════════════════════════════════════════════════════════════════════════════ -->
  <div class="app-layout" id="app-layout">

    <!-- SIDEBAR -->
    <aside class="sidebar" id="main-sidebar">
      <div class="sidebar-inner">
        <!-- Sidebar Header (Mobile) -->
        <div class="sidebar-mobile-header">
          <div class="sidebar-brand">
            <img src="images/logo.png" alt="Logo" class="sidebar-brand-img" onerror="this.onerror=null; this.src='images/logo.jpg';">
            <span>SMKN 1 CIBINONG</span>
          </div>
          <button class="sidebar-close-btn" onclick="App.closeSidebar()" aria-label="Tutup Menu">✕</button>
        </div>

        <div id="sidebar-nav-content">
          <!-- Populated by JS after login -->
        </div>
        <div class="sidebar-footer">
          <div class="sidebar-footer-brand">
            <strong>SMKN 1 CIBINONG</strong>
            <small>Jl. Karadenan No.1, Cibinong</small>
            <small>© 2026 · SMKN 1 CIBINONG</small>
          </div>
        </div>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="main-content" id="main-content">
      <!-- Initial loading placeholder -->
      <div class="boot-screen">
        <div class="boot-shield">
          <svg class="boot-shield-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="64" height="64">
            <path d="M24 10L6 18L24 26L42 18L24 10Z" fill="#1e3a8a"/>
            <path d="M42 18V28" stroke="#f59e0b" stroke-width="2"/>
            <circle cx="42" cy="30" r="2" fill="#f59e0b"/>
            <path d="M12 21.5V30C12 35 18 38 24 38C30 38 36 35 36 30V21.5" stroke="#1e3a8a" stroke-width="3" stroke-linecap="round" fill="none"/>
          </svg>
          <div class="boot-text">Memuat E-Learning SMKN 1 CIBINONG…</div>
          <div class="boot-bar"><div class="boot-bar-fill"></div></div>
        </div>
      </div>
    </main>

  </div><!-- /.app-layout -->

  <!-- Anti-Cheating Exam Guard -->
  <script src="js/exam_guard.js"></script>
  <!-- Main App -->
  <script src="js/app.js"></script>
</body>
</html>

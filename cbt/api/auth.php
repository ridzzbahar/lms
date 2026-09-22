<?php
// cbt/api/auth.php — E-Learning SMKN 1 CIBINONG Authentication API
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'status';

// ── LOGIN ──────────────────────────────────────────────────────────────────────
if ($action === 'login') {
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);

    $username = trim($data['username'] ?? $_POST['username'] ?? '');
    $password = trim($data['password'] ?? $_POST['password'] ?? '');

    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Username/NIS dan Password wajib diisi.']);
        exit;
    }

    // Allow login by username OR nip_nis
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR nip_nis = ? LIMIT 1");
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['user_id']  = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['name']     = $user['name'];
        $_SESSION['role']     = $user['role'];

        // Fetch class name if student
        $className = null;
        if ($user['class_id']) {
            $className = $pdo->prepare("SELECT class_name FROM classes WHERE id = ?");
            $className->execute([$user['class_id']]);
            $className = $className->fetchColumn();
        }

        echo json_encode([
            'success' => true,
            'message' => 'Login berhasil. Selamat datang di E-Learning SMKN 1 CIBINONG!',
            'user'    => [
                'id'         => $user['id'],
                'name'       => $user['name'],
                'username'   => $user['username'],
                'nip_nis'    => $user['nip_nis'],
                'role'       => $user['role'],
                'class_id'   => $user['class_id'],
                'class_name' => $className,
                'photo_url'  => $user['photo_url'] ?? null,
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Username/NIS atau password salah. Periksa kembali data Anda.']);
    }
    exit;
}

// ── LOGOUT ─────────────────────────────────────────────────────────────────────
if ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Anda telah berhasil keluar.']);
    exit;
}

// ── STATUS CHECK ───────────────────────────────────────────────────────────────
if (isset($_SESSION['user_id'])) {
    $className = null;
    if (!empty($_SESSION['class_id'])) {
        $cn = $pdo->prepare("SELECT class_name FROM classes WHERE id = ?");
        $cn->execute([$_SESSION['class_id']]);
        $className = $cn->fetchColumn();
    }

    // Re-fetch latest user data
    $stmt = $pdo->prepare("SELECT id, name, username, nip_nis, role, class_id, photo_url FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $u = $stmt->fetch();

    if ($u) {
        if ($u['class_id']) {
            $cn2 = $pdo->prepare("SELECT class_name FROM classes WHERE id = ?");
            $cn2->execute([$u['class_id']]);
            $className = $cn2->fetchColumn();
        }
        echo json_encode([
            'logged_in' => true,
            'user'      => [
                'id'         => $u['id'],
                'name'       => $u['name'],
                'username'   => $u['username'],
                'nip_nis'    => $u['nip_nis'],
                'role'       => $u['role'],
                'class_id'   => $u['class_id'],
                'class_name' => $className,
                'photo_url'  => $u['photo_url'] ?? null,
            ]
        ]);
    } else {
        session_destroy();
        echo json_encode(['logged_in' => false]);
    }
} else {
    echo json_encode(['logged_in' => false]);
}

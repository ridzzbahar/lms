<?php
// cbt/api/users.php - User Management API & Profile Update
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sesi berakhir, silakan login kembali.']);
    exit;
}

$role = $_SESSION['role'] ?? 'siswa';
$current_user_id = (int)$_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

// GET: List users or get single user
if ($method === 'GET') {
    $user_id_param = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($user_id_param > 0) {
        $stmt = $pdo->prepare("
            SELECT u.id, u.username, u.name, u.nip_nis, u.role, u.class_id, u.major, u.subjects, u.classes_taught, u.photo_url, u.created_at, c.class_name 
            FROM users u 
            LEFT JOIN classes c ON u.class_id = c.id 
            WHERE u.id = ?
        ");
        $stmt->execute([$user_id_param]);
        $user = $stmt->fetch();
        if ($user) {
            echo json_encode(['success' => true, 'user' => $user]);
        } else {
            echo json_encode(['success' => false, 'message' => 'User tidak ditemukan.']);
        }
        exit;
    }

    $filter_role = $_GET['role'] ?? null;
    $filter_class = isset($_GET['class_id']) ? intval($_GET['class_id']) : null;
    $filter_major = $_GET['major'] ?? null;

    $sql = "SELECT u.id, u.username, u.name, u.nip_nis, u.role, u.class_id, u.major, u.subjects, u.classes_taught, u.photo_url, u.created_at, c.class_name 
            FROM users u 
            LEFT JOIN classes c ON u.class_id = c.id 
            WHERE 1=1";
    $params = [];

    if ($filter_role) {
        $sql .= " AND u.role = ?";
        $params[] = $filter_role;
    }

    if ($filter_class) {
        $sql .= " AND u.class_id = ?";
        $params[] = $filter_class;
    }

    if ($filter_major) {
        $sql .= " AND u.major = ?";
        $params[] = $filter_major;
    }

    $sql .= " ORDER BY u.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll();

    echo json_encode(['success' => true, 'users' => $users]);
    exit;
}

// POST: Create, Update Profile, or Delete User
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? $_POST;
    $action = $data['action'] ?? 'create';

    // 1. Update Profile (Guru/User update their own profile or Admin updates any user)
    if ($action === 'update_profile') {
        $target_id = !empty($data['user_id']) ? intval($data['user_id']) : $current_user_id;

        if ($target_id !== $current_user_id && $role !== 'admin') {
            echo json_encode(['success' => false, 'message' => 'Anda tidak memiliki hak akses untuk mengubah profil pengguna lain.']);
            exit;
        }

        $name = trim($data['name'] ?? '');
        $nip_nis = trim($data['nip_nis'] ?? '');
        $major = trim($data['major'] ?? '');
        $subjects = trim($data['subjects'] ?? '');
        $classes_taught = trim($data['classes_taught'] ?? '');
        $password = trim($data['password'] ?? '');

        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Nama lengkap tidak boleh kosong.']);
            exit;
        }

        if (!empty($password)) {
            $hashed = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("
                UPDATE users 
                SET name = ?, nip_nis = ?, major = ?, subjects = ?, classes_taught = ?, password = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $nip_nis, $major ?: null, $subjects ?: null, $classes_taught ?: null, $hashed, $target_id]);
        } else {
            $stmt = $pdo->prepare("
                UPDATE users 
                SET name = ?, nip_nis = ?, major = ?, subjects = ?, classes_taught = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $nip_nis, $major ?: null, $subjects ?: null, $classes_taught ?: null, $target_id]);
        }

        // Update session name if updating self
        if ($target_id === $current_user_id) {
            $_SESSION['name'] = $name;
        }

        echo json_encode(['success' => true, 'message' => 'Profil berhasil diperbarui!']);
        exit;
    }

    // Following actions require Admin or Guru
    if ($role !== 'admin' && $role !== 'guru') {
        echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya Admin atau Guru yang dapat mengelola akun user.']);
        exit;
    }

    if ($action === 'create') {
        $username = trim($data['username'] ?? '');
        $password = trim($data['password'] ?? '');
        $name     = trim($data['name'] ?? '');
        $nip_nis  = trim($data['nip_nis'] ?? '');
        $new_role = trim($data['role'] ?? 'siswa');
        $class_id = !empty($data['class_id']) ? intval($data['class_id']) : null;
        $major    = trim($data['major'] ?? '') ?: null;
        $subjects = trim($data['subjects'] ?? '') ?: null;

        if (empty($username) || empty($password) || empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Username, Password, dan Nama Lengkap wajib diisi.']);
            exit;
        }

        if (!in_array($new_role, ['admin', 'guru', 'siswa'])) {
            $new_role = 'siswa';
        }

        // Check duplicate username
        $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
        $stmtCheck->execute([$username]);
        if ($stmtCheck->fetchColumn() > 0) {
            echo json_encode(['success' => false, 'message' => 'Username sudah digunakan, gunakan username lain.']);
            exit;
        }

        $hashedPass = password_hash($password, PASSWORD_DEFAULT);

        $stmtIns = $pdo->prepare("
            INSERT INTO users (username, password, name, nip_nis, role, class_id, major, subjects)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmtIns->execute([$username, $hashedPass, $name, $nip_nis, $new_role, $class_id, $major, $subjects]);

        echo json_encode(['success' => true, 'message' => 'User baru berhasil dibuat!', 'id' => $pdo->lastInsertId()]);
        exit;
    }

    if ($action === 'delete') {
        $target_id = intval($data['user_id'] ?? 0);
        if ($target_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID user tidak valid.']);
            exit;
        }

        if ($target_id == $_SESSION['user_id']) {
            echo json_encode(['success' => false, 'message' => 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.']);
            exit;
        }

        $stmtDel = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmtDel->execute([$target_id]);

        echo json_encode(['success' => true, 'message' => 'User berhasil dihapus.']);
        exit;
    }

    echo json_encode(['success' => false, 'message' => 'Aksi tidak valid.']);
    exit;
}

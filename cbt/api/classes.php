<?php
// cbt/api/classes.php - Classes Management API
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sesi berakhir, silakan login kembali.']);
    exit;
}

$role = $_SESSION['role'];
$method = $_SERVER['REQUEST_METHOD'];

// GET: List classes
if ($method === 'GET') {
    $stmt = $pdo->prepare("
        SELECT c.*, 
        (SELECT COUNT(*) FROM users u WHERE u.role='siswa' AND (u.class_id = c.id OR (u.major = c.major AND c.major != 'Umum' AND (u.class_id IS NULL OR u.class_id = c.id)))) as total_students
        FROM classes c 
        ORDER BY c.class_name ASC
    ");
    $stmt->execute();
    $classes = $stmt->fetchAll();

    echo json_encode(['success' => true, 'classes' => $classes]);
    exit;
}

// POST: Create or Delete class (Admin & Guru)
if ($method === 'POST') {
    if ($role !== 'admin' && $role !== 'guru') {
        echo json_encode(['success' => false, 'message' => 'Akses ditolak.']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? $_POST;
    $action = $data['action'] ?? 'create';

    if ($action === 'create') {
        $name = trim($data['class_name'] ?? '');
        $major = trim($data['major'] ?? 'Umum') ?: 'Umum';
        $year = trim($data['academic_year'] ?? '2026/2027');

        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Nama Kelas wajib diisi (contoh: XI SIJA 1).']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO classes (class_name, major, academic_year) VALUES (?, ?, ?)");
        try {
            $stmt->execute([$name, $major, $year]);
            echo json_encode(['success' => true, 'message' => 'Kelas berhasil ditambahkan!']);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'Nama kelas sudah ada: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete') {
        $class_id = intval($data['class_id'] ?? 0);
        $stmt = $pdo->prepare("DELETE FROM classes WHERE id = ?");
        $stmt->execute([$class_id]);

        echo json_encode(['success' => true, 'message' => 'Kelas berhasil dihapus.']);
        exit;
    }
}

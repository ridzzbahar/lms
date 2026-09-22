<?php
// cbt/api/courses.php - Courses / Subjects Management API (with Major filtering & CRUD)
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sesi berakhir, silakan login kembali.']);
    exit;
}

$role = $_SESSION['role'] ?? 'siswa';
$user_id = (int)$_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

// GET: List Courses
if ($method === 'GET') {
    $filter_major = $_GET['major'] ?? null;
    $filter_class = isset($_GET['class_id']) ? intval($_GET['class_id']) : null;

    $sql = "
        SELECT cr.*, cl.class_name, u.name as teacher_name,
        (SELECT COUNT(*) FROM quizzes WHERE course_id = cr.id) as quiz_count,
        (SELECT COUNT(*) FROM course_materials WHERE course_id = cr.id) as material_count,
        (SELECT COUNT(*) FROM assignments WHERE course_id = cr.id) as assignment_count
        FROM courses cr
        LEFT JOIN classes cl ON cr.class_id = cl.id
        LEFT JOIN users u ON cr.teacher_id = u.id
        WHERE 1=1
    ";
    $params = [];

    // If student, filter by student's major or Umum
    if ($role === 'siswa') {
        $userRow = $pdo->prepare("SELECT major, class_id FROM users WHERE id = ?");
        $userRow->execute([$user_id]);
        $uInfo = $userRow->fetch();
        $studentMajor = $uInfo['major'] ?? 'Umum';

        $sql .= " AND (cr.major = 'Umum' OR cr.major = ? OR cr.major IS NULL)";
        $params[] = $studentMajor;
    } elseif (!empty($filter_major) && $filter_major !== 'all') {
        $sql .= " AND (cr.major = ? OR cr.major = 'Umum')";
        $params[] = $filter_major;
    }

    if ($filter_class && $filter_class > 0) {
        $sql .= " AND (cr.class_id = ? OR cr.class_id IS NULL)";
        $params[] = $filter_class;
    }

    $sql .= " ORDER BY cr.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $courses = $stmt->fetchAll();

    echo json_encode(['success' => true, 'courses' => $courses]);
    exit;
}

// POST: Create, Update, or Delete course (Admin & Guru)
if ($method === 'POST') {
    if ($role !== 'admin' && $role !== 'guru') {
        echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya Admin atau Guru yang berwenang.']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? $_POST;
    $action = $data['action'] ?? 'create';

    if ($action === 'create') {
        $code = trim($data['course_code'] ?? '');
        $name = trim($data['course_name'] ?? '');
        $description = trim($data['description'] ?? '');
        $class_id = !empty($data['class_id']) ? intval($data['class_id']) : null;
        $teacher_id = !empty($data['teacher_id']) ? intval($data['teacher_id']) : $user_id;
        $major = trim($data['major'] ?? 'Umum') ?: 'Umum';
        $icon = trim($data['icon'] ?? '📚');

        if (empty($code) || empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Kode Mapel dan Nama Mata Pelajaran wajib diisi.']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO courses (course_code, course_name, description, class_id, teacher_id, major, icon) VALUES (?, ?, ?, ?, ?, ?, ?)");
        try {
            $stmt->execute([$code, $name, $description, $class_id, $teacher_id, $major, $icon]);
            echo json_encode(['success' => true, 'message' => 'Mata pelajaran berhasil ditambahkan!', 'id' => $pdo->lastInsertId()]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'Kode Mata Pelajaran sudah terdaftar: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'update' || $action === 'edit') {
        $course_id = intval($data['id'] ?? $data['course_id'] ?? 0);
        $code = trim($data['course_code'] ?? '');
        $name = trim($data['course_name'] ?? '');
        $description = trim($data['description'] ?? '');
        $class_id = !empty($data['class_id']) ? intval($data['class_id']) : null;
        $teacher_id = !empty($data['teacher_id']) ? intval($data['teacher_id']) : null;
        $major = trim($data['major'] ?? 'Umum') ?: 'Umum';
        $icon = trim($data['icon'] ?? '📚');

        if ($course_id <= 0 || empty($code) || empty($name)) {
            echo json_encode(['success' => false, 'message' => 'ID, Kode Mapel, dan Nama Mata Pelajaran wajib diisi.']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE courses SET course_code = ?, course_name = ?, description = ?, class_id = ?, teacher_id = ?, major = ?, icon = ? WHERE id = ?");
        try {
            $stmt->execute([$code, $name, $description, $class_id, $teacher_id, $major, $icon, $course_id]);
            echo json_encode(['success' => true, 'message' => 'Mata pelajaran berhasil diperbarui!']);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'Gagal memperbarui mapel: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete') {
        $course_id = intval($data['course_id'] ?? $data['id'] ?? 0);
        if ($course_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID Mapel tidak valid.']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM courses WHERE id = ?");
        $stmt->execute([$course_id]);

        echo json_encode(['success' => true, 'message' => 'Mata pelajaran berhasil dihapus.']);
        exit;
    }

    echo json_encode(['success' => false, 'message' => 'Aksi tidak valid.']);
    exit;
}

<?php
// api/course_detail.php — E-Learning SMKN 1 CIBINONG
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
$uid    = (int)$_SESSION['user_id'];
$role   = $_SESSION['role'] ?? 'siswa';
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'overview';
$cid    = (int)($_GET['course_id'] ?? 0);

if (!$cid) {
    echo json_encode(['success' => false, 'message' => 'course_id required']);
    exit;
}

// ── Overview ───────────────────────────────────────────────────────────────────
if ($action === 'overview') {
    $q = $pdo->prepare("
        SELECT c.*, u.name AS teacher_name, cl.class_name
        FROM courses c
        LEFT JOIN users u ON c.teacher_id = u.id
        LEFT JOIN classes cl ON c.class_id = cl.id
        WHERE c.id = ?");
    $q->execute([$cid]);
    $course = $q->fetch();
    if (!$course) {
        echo json_encode(['success' => false, 'message' => 'Kursus tidak ditemukan']);
        exit;
    }

    // Stats
    $stats = ['materials' => 0, 'assignments' => 0, 'quizzes' => 0, 'discussions' => 0];

    try {
        $st1 = $pdo->prepare("SELECT COUNT(*) FROM course_materials WHERE course_id = ?");
        $st1->execute([$cid]);
        $stats['materials'] = (int)$st1->fetchColumn();
    } catch (PDOException $e) {}

    try {
        $st2 = $pdo->prepare("SELECT COUNT(*) FROM assignments WHERE course_id = ?");
        $st2->execute([$cid]);
        $stats['assignments'] = (int)$st2->fetchColumn();
    } catch (PDOException $e) {}

    try {
        $st3 = $pdo->prepare("SELECT COUNT(*) FROM quizzes WHERE course_id = ? AND status = 'active'");
        $st3->execute([$cid]);
        $stats['quizzes'] = (int)$st3->fetchColumn();
    } catch (PDOException $e) {}

    try {
        $st4 = $pdo->prepare("SELECT COUNT(*) FROM course_discussions WHERE course_id = ?");
        $st4->execute([$cid]);
        $stats['discussions'] = (int)$st4->fetchColumn();
    } catch (PDOException $e) {}

    echo json_encode(['success' => true, 'data' => $course, 'course' => $course, 'stats' => $stats]);
    exit;
}

// ── Materials ──────────────────────────────────────────────────────────────────
if ($action === 'materials') {
    $q = $pdo->prepare("SELECT m.*, u.name AS uploader FROM course_materials m LEFT JOIN users u ON m.created_by = u.id WHERE m.course_id = ? ORDER BY m.order_num ASC, m.created_at DESC");
    $q->execute([$cid]);
    $rows = $q->fetchAll();
    echo json_encode(['success' => true, 'data' => $rows, 'materials' => $rows]);
    exit;
}

// ── Assignments ────────────────────────────────────────────────────────────────
if ($action === 'assignments') {
    $q = $pdo->prepare("
        SELECT a.*, u.name AS teacher_name,
          (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id) AS total_submissions,
          (SELECT s2.score FROM assignment_submissions s2 WHERE s2.assignment_id = a.id AND s2.student_id = ? LIMIT 1) AS my_score,
          (SELECT s3.submitted_at FROM assignment_submissions s3 WHERE s3.assignment_id = a.id AND s3.student_id = ? LIMIT 1) AS my_submitted_at
        FROM assignments a 
        LEFT JOIN users u ON a.created_by = u.id
        WHERE a.course_id = ? 
        ORDER BY a.due_date ASC");
    $q->execute([$uid, $uid, $cid]);
    $rows = $q->fetchAll();
    echo json_encode(['success' => true, 'data' => $rows, 'assignments' => $rows]);
    exit;
}

// ── Discussions ────────────────────────────────────────────────────────────────
if ($action === 'discussions') {
    $q = $pdo->prepare("
        SELECT d.*, u.name AS author, u.role AS author_role
        FROM course_discussions d 
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.course_id = ? AND (d.parent_id IS NULL OR d.parent_id = 0)
        ORDER BY d.created_at DESC 
        LIMIT 50");
    $q->execute([$cid]);
    $threads = $q->fetchAll();
    foreach ($threads as &$t) {
        $r = $pdo->prepare("SELECT d.*, u.name AS author FROM course_discussions d LEFT JOIN users u ON d.user_id = u.id WHERE d.parent_id = ? ORDER BY d.created_at ASC");
        $r->execute([$t['id']]);
        $t['replies'] = $r->fetchAll();
    }
    echo json_encode(['success' => true, 'data' => $threads, 'discussions' => $threads]);
    exit;
}

// ── POST discussion ────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'discussions') {
    $raw = file_get_contents('php://input');
    $d   = json_decode($raw, true) ?? $_POST;
    $msg = trim($d['message'] ?? '');
    $parent = (int)($d['parent_id'] ?? 0) ?: null;
    if (!$msg) {
        echo json_encode(['success' => false, 'message' => 'Pesan tidak boleh kosong']);
        exit;
    }
    $pdo->prepare("INSERT INTO course_discussions (course_id, user_id, message, parent_id) VALUES (?, ?, ?, ?)")->execute([$cid, $uid, $msg, $parent]);
    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    exit;
}

// ── POST material (guru/admin) ─────────────────────────────────────────────────
if ($method === 'POST' && $action === 'add_material' && in_array($role, ['admin', 'guru'])) {
    $raw   = file_get_contents('php://input');
    $d     = json_decode($raw, true) ?? $_POST;
    $title = trim($d['title'] ?? '');
    $type  = in_array($d['type'] ?? 'text', ['pdf', 'video', 'link', 'text']) ? $d['type'] : 'text';
    $url   = trim($d['content_url'] ?? '');
    $cnt   = trim($d['content'] ?? '');
    if (!$title) {
        echo json_encode(['success' => false, 'message' => 'Judul wajib diisi']);
        exit;
    }
    $stOrd = $pdo->prepare("SELECT COALESCE(MAX(order_num), 0) + 1 FROM course_materials WHERE course_id = ?");
    $stOrd->execute([$cid]);
    $ord = (int)$stOrd->fetchColumn();

    $pdo->prepare("INSERT INTO course_materials (course_id, title, type, content_url, content, order_num, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
        ->execute([$cid, $title, $type, $url ?: null, $cnt ?: null, $ord, $uid]);
    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    exit;
}

// ── DELETE material (guru/admin) ───────────────────────────────────────────────
if ($method === 'DELETE' && $action === 'del_material' && in_array($role, ['admin', 'guru'])) {
    $raw = file_get_contents('php://input');
    $d   = json_decode($raw, true) ?? $_POST;
    $id  = (int)($d['id'] ?? $_GET['id'] ?? 0);
    $pdo->prepare("DELETE FROM course_materials WHERE id = ? AND course_id = ?")->execute([$id, $cid]);
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action or method']);

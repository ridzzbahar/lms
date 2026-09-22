<?php
// api/quizzes.php — E-Learning SMKN 1 CIBINONG (Full CRUD & Student Attempt Mapping)
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sesi berakhir, silakan login kembali.']);
    exit;
}
$uid    = (int)$_SESSION['user_id'];
$role   = $_SESSION['role'] ?? 'siswa';
$method = $_SERVER['REQUEST_METHOD'];

// ── GET ────────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'list';

    if ($action === 'list') {
        if ($role === 'siswa') {
            // Get student's major
            $uStmt = $pdo->prepare("SELECT major FROM users WHERE id = ?");
            $uStmt->execute([$uid]);
            $userRow = $uStmt->fetch();
            $major   = $userRow['major'] ?? 'Umum';

            $q = $pdo->prepare("
                SELECT qz.*, c.course_name, c.icon,
                  (SELECT COUNT(*) FROM questions qq WHERE qq.quiz_id = qz.id) AS total_questions,
                  (SELECT COUNT(*) FROM questions qq WHERE qq.quiz_id = qz.id) AS question_count,
                  (SELECT ea.status FROM exam_attempts ea WHERE ea.quiz_id = qz.id AND ea.user_id = ? ORDER BY ea.started_at DESC LIMIT 1) AS attempt_status,
                  (SELECT ea.score FROM exam_attempts ea WHERE ea.quiz_id = qz.id AND ea.user_id = ? ORDER BY ea.started_at DESC LIMIT 1) AS attempt_score,
                  (SELECT ea.id FROM exam_attempts ea WHERE ea.quiz_id = qz.id AND ea.user_id = ? ORDER BY ea.started_at DESC LIMIT 1) AS attempt_id
                FROM quizzes qz
                LEFT JOIN courses c ON qz.course_id = c.id
                WHERE qz.status = 'active'
                  AND (c.major = 'Umum' OR c.major = ? OR c.major IS NULL OR qz.course_id IS NULL)
                  AND (qz.release_date IS NULL OR qz.release_date <= CURDATE())
                ORDER BY qz.created_at DESC");
            $q->execute([$uid, $uid, $uid, $major]);
            $list = $q->fetchAll();

            foreach ($list as &$item) {
                if (!empty($item['attempt_status']) || !empty($item['attempt_id'])) {
                    $item['my_attempt'] = [
                        'id'     => $item['attempt_id'],
                        'status' => $item['attempt_status'],
                        'score'  => $item['attempt_score']
                    ];
                } else {
                    $item['my_attempt'] = null;
                }
            }

            echo json_encode(['success' => true, 'data' => $list, 'quizzes' => $list]);
            exit;
        } else {
            // Guru sees their own; admin sees all
            $q = $pdo->prepare("
                SELECT qz.*, c.course_name, c.icon, u.name AS creator_name,
                  (SELECT COUNT(*) FROM questions qq WHERE qq.quiz_id = qz.id) AS question_count,
                  (SELECT COUNT(*) FROM questions qq WHERE qq.quiz_id = qz.id) AS total_questions,
                  (SELECT COUNT(*) FROM exam_attempts ea WHERE ea.quiz_id = qz.id AND ea.status = 'completed') AS attempt_count
                FROM quizzes qz
                LEFT JOIN courses c ON qz.course_id = c.id
                LEFT JOIN users u ON qz.created_by = u.id
                WHERE (? = 'admin' OR qz.created_by = ?)
                ORDER BY qz.created_at DESC");
            $q->execute([$role, $uid]);
            $list = $q->fetchAll();
            echo json_encode(['success' => true, 'data' => $list, 'quizzes' => $list]);
            exit;
        }
    }

    if ($action === 'detail') {
        $id = (int)($_GET['id'] ?? 0);
        $q  = $pdo->prepare("SELECT qz.*, c.course_name FROM quizzes qz LEFT JOIN courses c ON qz.course_id = c.id WHERE qz.id = ?");
        $q->execute([$id]);
        $quiz = $q->fetch();
        if (!$quiz) { echo json_encode(['success' => false, 'message' => 'Quiz tidak ditemukan']); exit; }
        if ($role !== 'admin' && $quiz['created_by'] != $uid) { echo json_encode(['success' => false, 'message' => 'Forbidden']); exit; }
        $qs = $pdo->prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY id");
        $qs->execute([$id]);
        $quiz['questions'] = $qs->fetchAll();
        echo json_encode(['success' => true, 'data' => $quiz]);
        exit;
    }

    // Admin reset exam attempt
    if ($action === 'reset_attempt' && in_array($role, ['admin', 'guru'])) {
        $userId = (int)($_GET['user_id'] ?? 0);
        $quizId = (int)($_GET['quiz_id'] ?? 0);
        $pdo->prepare("DELETE FROM exam_answers WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE quiz_id = ? AND user_id = ?)")->execute([$quizId, $userId]);
        $pdo->prepare("DELETE FROM exam_attempts WHERE quiz_id = ? AND user_id = ?")->execute([$quizId, $userId]);
        $pdo->prepare("DELETE FROM cheat_logs WHERE user_id = ? AND attempt_id NOT IN (SELECT id FROM exam_attempts)")->execute([$userId]);
        echo json_encode(['success' => true, 'message' => 'Ujian berhasil direset']);
        exit;
    }

    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    exit;
}

// ── POST — create quiz ─────────────────────────────────────────────────────────
if ($method === 'POST' && in_array($role, ['admin', 'guru'])) {
    $d = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $title    = trim($d['title'] ?? '');
    $desc     = trim($d['description'] ?? '');
    $dur      = max(1, (int)($d['duration_minutes'] ?? 30));
    $kkm      = max(0, min(100, (int)($d['kkm'] ?? 70)));
    $shuffle  = !empty($d['shuffle_questions']) ? 1 : 0;
    $release  = $d['release_date'] ?? null;
    $courseId = (int)($d['course_id'] ?? 0) ?: null;
    $status   = in_array($d['status'] ?? 'active', ['active', 'draft']) ? ($d['status'] ?? 'active') : 'active';
    if (!$title) { echo json_encode(['success' => false, 'message' => 'Judul wajib diisi']); exit; }
    $pdo->prepare("INSERT INTO quizzes (title, description, course_id, duration_minutes, kkm, shuffle_questions, release_date, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$title, $desc, $courseId, $dur, $kkm, $shuffle, $release ?: null, $uid, $status]);
    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    exit;
}

// ── PUT — update quiz ──────────────────────────────────────────────────────────
if ($method === 'PUT' && in_array($role, ['admin', 'guru'])) {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    $row = $pdo->prepare("SELECT * FROM quizzes WHERE id = ?");
    $row->execute([$id]);
    $quiz = $row->fetch();
    if (!$quiz) { echo json_encode(['success' => false, 'message' => 'Quiz tidak ditemukan']); exit; }
    if ($role !== 'admin' && $quiz['created_by'] != $uid) { echo json_encode(['success' => false, 'message' => 'Forbidden']); exit; }
    $title    = trim($d['title'] ?? $quiz['title']);
    $desc     = trim($d['description'] ?? $quiz['description']);
    $dur      = max(1, (int)($d['duration_minutes'] ?? $quiz['duration_minutes']));
    $kkm      = max(0, min(100, (int)($d['kkm'] ?? $quiz['kkm'])));
    $shuffle  = isset($d['shuffle_questions']) ? (int)$d['shuffle_questions'] : $quiz['shuffle_questions'];
    $release  = $d['release_date'] ?? $quiz['release_date'];
    $courseId = isset($d['course_id']) ? ((int)$d['course_id'] ?: null) : $quiz['course_id'];
    $status   = in_array($d['status'] ?? $quiz['status'], ['active', 'draft']) ? ($d['status'] ?? $quiz['status']) : $quiz['status'];
    $pdo->prepare("UPDATE quizzes SET title = ?, description = ?, course_id = ?, duration_minutes = ?, kkm = ?, shuffle_questions = ?, release_date = ?, status = ? WHERE id = ?")
        ->execute([$title, $desc, $courseId, $dur, $kkm, $shuffle, $release ?: null, $status, $id]);
    echo json_encode(['success' => true]);
    exit;
}

// ── DELETE — delete quiz ───────────────────────────────────────────────────────
if ($method === 'DELETE' && in_array($role, ['admin', 'guru'])) {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? $_GET['id'] ?? 0);
    $row = $pdo->prepare("SELECT created_by FROM quizzes WHERE id = ?");
    $row->execute([$id]);
    $quiz = $row->fetch();
    if (!$quiz) { echo json_encode(['success' => false, 'message' => 'Quiz tidak ditemukan']); exit; }
    if ($role !== 'admin' && $quiz['created_by'] != $uid) { echo json_encode(['success' => false, 'message' => 'Forbidden']); exit; }
    $pdo->prepare("DELETE FROM quizzes WHERE id = ?")->execute([$id]);
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Method not allowed']);

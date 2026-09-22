<?php
// cbt/api/questions.php — Questions Management (Multiple Choice & Essay)
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sesi berakhir, silakan login kembali.']);
    exit;
}

$user_id = (int)$_SESSION['user_id'];
$role = $_SESSION['role'] ?? 'siswa';
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET: List questions for a quiz
if ($method === 'GET') {
    $quiz_id = intval($_GET['quiz_id'] ?? 0);
    if ($quiz_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Quiz ID tidak valid.']);
        exit;
    }

    if (in_array($role, ['guru', 'admin'])) {
        // Teachers/Admins see all details including correct_option & essay_answer
        $stmt = $pdo->prepare("SELECT id, quiz_id, type, question_text, option_a, option_b, option_c, option_d, correct_option, essay_answer, points, created_at FROM questions WHERE quiz_id = ? ORDER BY id ASC");
        $stmt->execute([$quiz_id]);
        $questions = $stmt->fetchAll();
    } else {
        // Students do NOT see correct_option or essay_answer
        $stmt = $pdo->prepare("SELECT id, quiz_id, type, question_text, option_a, option_b, option_c, option_d, points FROM questions WHERE quiz_id = ? ORDER BY id ASC");
        $stmt->execute([$quiz_id]);
        $questions = $stmt->fetchAll();
    }

    echo json_encode(['success' => true, 'questions' => $questions]);
    exit;
}

// Handle POST: Create, Edit, or Delete question (Guru & Admin)
if ($method === 'POST') {
    if (!in_array($role, ['guru', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya guru atau admin yang dapat mengelola soal.']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? $_POST;
    $action = $data['action'] ?? 'create';

    if ($action === 'create') {
        $quiz_id = intval($data['quiz_id'] ?? 0);
        $type = in_array($data['type'] ?? '', ['multiple_choice', 'essay']) ? $data['type'] : 'multiple_choice';
        $question_text = trim($data['question_text'] ?? '');
        $points = max(1, intval($data['points'] ?? 1));

        if ($quiz_id <= 0 || empty($question_text)) {
            echo json_encode(['success' => false, 'message' => 'Teks soal wajib diisi.']);
            exit;
        }

        if ($type === 'multiple_choice') {
            $option_a = trim($data['option_a'] ?? '');
            $option_b = trim($data['option_b'] ?? '');
            $option_c = trim($data['option_c'] ?? '');
            $option_d = trim($data['option_d'] ?? '');
            $correct_option = strtoupper(trim($data['correct_option'] ?? 'A'));

            if (empty($option_a) || empty($option_b) || empty($option_c) || empty($option_d)) {
                echo json_encode(['success' => false, 'message' => 'Semua pilihan jawaban (A, B, C, D) wajib diisi untuk pilihan ganda.']);
                exit;
            }

            if (!in_array($correct_option, ['A', 'B', 'C', 'D'])) {
                $correct_option = 'A';
            }

            $stmt = $pdo->prepare("
                INSERT INTO questions (quiz_id, type, question_text, option_a, option_b, option_c, option_d, correct_option, points)
                VALUES (?, 'multiple_choice', ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$quiz_id, $question_text, $option_a, $option_b, $option_c, $option_d, $correct_option, $points]);
        } else {
            // Essay
            $essay_answer = trim($data['essay_answer'] ?? '');
            $stmt = $pdo->prepare("
                INSERT INTO questions (quiz_id, type, question_text, essay_answer, points)
                VALUES (?, 'essay', ?, ?, ?)
            ");
            $stmt->execute([$quiz_id, $question_text, $essay_answer, $points]);
        }

        echo json_encode(['success' => true, 'message' => 'Soal berhasil ditambahkan!', 'id' => $pdo->lastInsertId()]);
        exit;
    }

    if ($action === 'update' || $action === 'edit') {
        $question_id = intval($data['question_id'] ?? $data['id'] ?? 0);
        $type = in_array($data['type'] ?? '', ['multiple_choice', 'essay']) ? $data['type'] : 'multiple_choice';
        $question_text = trim($data['question_text'] ?? '');
        $points = max(1, intval($data['points'] ?? 1));

        if ($question_id <= 0 || empty($question_text)) {
            echo json_encode(['success' => false, 'message' => 'ID soal dan teks soal wajib diisi.']);
            exit;
        }

        if ($type === 'multiple_choice') {
            $option_a = trim($data['option_a'] ?? '');
            $option_b = trim($data['option_b'] ?? '');
            $option_c = trim($data['option_c'] ?? '');
            $option_d = trim($data['option_d'] ?? '');
            $correct_option = strtoupper(trim($data['correct_option'] ?? 'A'));

            if (empty($option_a) || empty($option_b) || empty($option_c) || empty($option_d)) {
                echo json_encode(['success' => false, 'message' => 'Semua pilihan jawaban (A, B, C, D) wajib diisi untuk pilihan ganda.']);
                exit;
            }

            if (!in_array($correct_option, ['A', 'B', 'C', 'D'])) {
                $correct_option = 'A';
            }

            $stmt = $pdo->prepare("
                UPDATE questions 
                SET type = 'multiple_choice', question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, points = ?
                WHERE id = ?
            ");
            $stmt->execute([$question_text, $option_a, $option_b, $option_c, $option_d, $correct_option, $points, $question_id]);
        } else {
            // Essay
            $essay_answer = trim($data['essay_answer'] ?? '');
            $stmt = $pdo->prepare("
                UPDATE questions 
                SET type = 'essay', question_text = ?, option_a = NULL, option_b = NULL, option_c = NULL, option_d = NULL, correct_option = NULL, essay_answer = ?, points = ?
                WHERE id = ?
            ");
            $stmt->execute([$question_text, $essay_answer, $points, $question_id]);
        }

        echo json_encode(['success' => true, 'message' => 'Soal berhasil diperbarui!']);
        exit;
    }

    if ($action === 'delete') {
        $question_id = intval($data['question_id'] ?? $data['id'] ?? 0);
        if ($question_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID soal tidak valid.']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM questions WHERE id = ?");
        $stmt->execute([$question_id]);

        echo json_encode(['success' => true, 'message' => 'Soal berhasil dihapus.']);
        exit;
    }

    echo json_encode(['success' => false, 'message' => 'Aksi tidak dikenali.']);
    exit;
}

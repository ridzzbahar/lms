<?php
// cbt/api/exam.php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sesi telah berakhir, silakan login kembali.']);
    exit;
}

$user_id = $_SESSION['user_id'];
$role = $_SESSION['role'];

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?? [];
$action = $_GET['action'] ?? $data['action'] ?? $_POST['action'] ?? '';

// 1. START EXAM ATTEMPT
if ($action === 'start') {
    $quiz_id = intval($data['quiz_id'] ?? $_GET['quiz_id'] ?? 0);
    if ($quiz_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Quiz ID tidak valid.']);
        exit;
    }

    // Check if disqualified
    $stmtDisq = $pdo->prepare("SELECT * FROM exam_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'disqualified' ORDER BY id DESC LIMIT 1");
    $stmtDisq->execute([$quiz_id, $user_id]);
    $disqAtt = $stmtDisq->fetch();
    if ($disqAtt) {
        echo json_encode(['success' => false, 'message' => 'Anda telah DIDISKUALIFIKASI dari ujian ini. Silakan melapor ke Pengawas/Admin untuk Reset Ujian.']);
        exit;
    }

    // ── ONE-ATTEMPT-ONLY RULE ─────────────────────────────────────────────────
    // Block students who already completed the exam from starting again
    $stmtCompleted = $pdo->prepare("SELECT id, score, finished_at FROM exam_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1");
    $stmtCompleted->execute([$quiz_id, $user_id]);
    $completedAtt = $stmtCompleted->fetch();
    if ($completedAtt) {
        echo json_encode([
            'success'  => false,
            'message'  => 'Anda sudah mengerjakan ujian ini dan tidak dapat mengulang kembali. Ujian hanya boleh dikerjakan 1 (satu) kali. Hubungi Admin atau Guru jika diperlukan reset.',
            'already_completed' => true,
            'score'    => $completedAtt['score'],
            'finished_at' => $completedAtt['finished_at']
        ]);
        exit;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check existing ongoing attempt
    $stmtCheck = $pdo->prepare("SELECT * FROM exam_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'in_progress'");
    $stmtCheck->execute([$quiz_id, $user_id]);
    $existing = $stmtCheck->fetch();

    if ($existing) {
        $attempt_id = $existing['id'];
        $violations = $existing['violations_count'];
    } else {
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM questions WHERE quiz_id = ?");
        $stmtCount->execute([$quiz_id]);
        $total_questions = $stmtCount->fetchColumn();

        $stmtIns = $pdo->prepare("
            INSERT INTO exam_attempts (quiz_id, user_id, total_questions, violations_count, status, started_at)
            VALUES (?, ?, ?, 0, 'in_progress', NOW())
        ");
        $stmtIns->execute([$quiz_id, $user_id, $total_questions]);
        $attempt_id = $pdo->lastInsertId();
        $violations = 0;
    }

    $stmtQz = $pdo->prepare("SELECT title, duration_minutes, kkm FROM quizzes WHERE id = ?");
    $stmtQz->execute([$quiz_id]);
    $quiz = $stmtQz->fetch();

    $stmtQuestions = $pdo->prepare("
        SELECT id, type, question_text, option_a, option_b, option_c, option_d, points 
        FROM questions WHERE quiz_id = ? ORDER BY id ASC
    ");
    $stmtQuestions->execute([$quiz_id]);
    $questions = $stmtQuestions->fetchAll();

    $stmtAns = $pdo->prepare("SELECT question_id, selected_option, essay_response FROM exam_answers WHERE attempt_id = ?");
    $stmtAns->execute([$attempt_id]);
    $saved_rows = $stmtAns->fetchAll();
    $saved_answers = [];
    $saved_essays = [];
    foreach ($saved_rows as $sr) {
        if (!empty($sr['selected_option'])) $saved_answers[$sr['question_id']] = $sr['selected_option'];
        if (!empty($sr['essay_response']))  $saved_essays[$sr['question_id']]  = $sr['essay_response'];
    }

    echo json_encode([
        'success' => true,
        'attempt_id' => $attempt_id,
        'quiz' => $quiz,
        'questions' => $questions,
        'saved_answers' => $saved_answers,
        'saved_essays' => $saved_essays,
        'violations_count' => $violations
    ]);
    exit;
}

// 2. LOG ANTI-CHEATING VIOLATION
if ($action === 'log_violation') {
    $attempt_id = intval($data['attempt_id'] ?? 0);
    $type = trim($data['type'] ?? 'tab_switch');
    $details = trim($data['details'] ?? 'Meninggalkan halaman ujian / beralih tab browser');

    if ($attempt_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Attempt ID tidak valid.']);
        exit;
    }

    $stmtLog = $pdo->prepare("INSERT INTO cheat_logs (attempt_id, user_id, violation_type, details) VALUES (?, ?, ?, ?)");
    $stmtLog->execute([$attempt_id, $user_id, $type, $details]);

    $stmtUpd = $pdo->prepare("UPDATE exam_attempts SET violations_count = violations_count + 1 WHERE id = ? AND user_id = ?");
    $stmtUpd->execute([$attempt_id, $user_id]);

    $stmtCheck = $pdo->prepare("SELECT violations_count, status FROM exam_attempts WHERE id = ?");
    $stmtCheck->execute([$attempt_id]);
    $attempt = $stmtCheck->fetch();

    $violCount = intval($attempt['violations_count'] ?? 0);
    $disqualified = false;
    $max_violations = 3;

    if ($violCount >= $max_violations) {
        $disqualified = true;
        $stmtDisq = $pdo->prepare("UPDATE exam_attempts SET status = 'disqualified', finished_at = NOW() WHERE id = ?");
        $stmtDisq->execute([$attempt_id]);
    }

    echo json_encode([
        'success' => true,
        'violations_count' => $violCount,
        'max_violations' => $max_violations,
        'disqualified' => $disqualified,
        'message' => $disqualified 
            ? 'Anda telah mencapai 3x pelanggaran tab-switch. Ujian Anda otomatis dibatalkan & didiskualifikasi! Silakan melapor ke Admin/Guru untuk reset ujian.' 
            : 'Peringatan Pelanggaran Ujian! Terdeteksi keluar dari web ujian (' . $violCount . '/' . $max_violations . ').'
    ]);
    exit;
}

// 3. SAVE SINGLE QUESTION ANSWER
if ($action === 'save_answer') {
    $attempt_id  = intval($data['attempt_id'] ?? 0);
    $question_id = intval($data['question_id'] ?? 0);
    $selected    = strtoupper(trim($data['selected_option'] ?? ''));
    $essay_resp  = trim($data['essay_response'] ?? '');

    if ($attempt_id <= 0 || $question_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Parameter tidak lengkap.']);
        exit;
    }

    $stmtCheck = $pdo->prepare("SELECT id FROM exam_answers WHERE attempt_id = ? AND question_id = ?");
    $stmtCheck->execute([$attempt_id, $question_id]);
    $ansId = $stmtCheck->fetchColumn();

    if ($ansId) {
        $stmtUpd = $pdo->prepare("UPDATE exam_answers SET selected_option = ?, essay_response = ? WHERE id = ?");
        $stmtUpd->execute([$selected ?: null, $essay_resp ?: null, $ansId]);
    } else {
        $stmtIns = $pdo->prepare("INSERT INTO exam_answers (attempt_id, question_id, selected_option, essay_response) VALUES (?, ?, ?, ?)");
        $stmtIns->execute([$attempt_id, $question_id, $selected ?: null, $essay_resp ?: null]);
    }

    echo json_encode(['success' => true]);
    exit;
}

// 4. SUBMIT EXAM & AUTO GRADE
if ($action === 'submit') {
    $attempt_id = intval($data['attempt_id'] ?? 0);
    if ($attempt_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Attempt ID tidak valid.']);
        exit;
    }

    $stmtAtt = $pdo->prepare("SELECT * FROM exam_attempts WHERE id = ? AND user_id = ?");
    $stmtAtt->execute([$attempt_id, $user_id]);
    $attempt = $stmtAtt->fetch();

    if (!$attempt) {
        echo json_encode(['success' => false, 'message' => 'Data ujian tidak ditemukan.']);
        exit;
    }

    if ($attempt['status'] === 'completed' || $attempt['status'] === 'disqualified') {
        echo json_encode([
            'success' => true,
            'message' => 'Ujian sudah disubmit.',
            'score' => $attempt['score'],
            'status' => $attempt['status']
        ]);
        exit;
    }

    $quiz_id = $attempt['quiz_id'];
    $stmtQ = $pdo->prepare("SELECT id, correct_option FROM questions WHERE quiz_id = ?");
    $stmtQ->execute([$quiz_id]);
    $questions = $stmtQ->fetchAll();

    $total_q = count($questions);
    $correct_cnt = 0;

    foreach ($questions as $q) {
        $q_id = $q['id'];
        $correct_key = strtoupper($q['correct_option']);

        $stmtAns = $pdo->prepare("SELECT selected_option FROM exam_answers WHERE attempt_id = ? AND question_id = ?");
        $stmtAns->execute([$attempt_id, $q_id]);
        $user_opt = strtoupper(trim($stmtAns->fetchColumn() ?: ''));

        $is_correct = ($user_opt === $correct_key) ? 1 : 0;
        if ($is_correct) $correct_cnt++;

        $stmtUpdAns = $pdo->prepare("UPDATE exam_answers SET is_correct = ? WHERE attempt_id = ? AND question_id = ?");
        $stmtUpdAns->execute([$is_correct, $attempt_id, $q_id]);
    }

    $score = ($total_q > 0) ? round(($correct_cnt / $total_q) * 100, 2) : 0;
    $final_status = ($attempt['violations_count'] >= 3) ? 'disqualified' : 'completed';

    $stmtFinal = $pdo->prepare("
        UPDATE exam_attempts 
        SET score = ?, total_questions = ?, correct_answers = ?, status = ?, finished_at = NOW() 
        WHERE id = ?
    ");
    $stmtFinal->execute([$score, $total_q, $correct_cnt, $final_status, $attempt_id]);

    echo json_encode([
        'success' => true,
        'message' => 'Ujian berhasil diselesaikan!',
        'score' => $score,
        'total_questions' => $total_q,
        'correct_answers' => $correct_cnt,
        'violations_count' => $attempt['violations_count'],
        'status' => $final_status
    ]);
    exit;
}

// 5. RESET EXAM ATTEMPT (FITUR ADMIN & GURU UNTUK SISWA DISKUALIFIKASI)
if ($action === 'reset') {
    if ($role !== 'admin' && $role !== 'guru') {
        echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya Admin atau Guru yang dapat mereset ujian siswa.']);
        exit;
    }

    $attempt_id = intval($data['attempt_id'] ?? $_GET['attempt_id'] ?? 0);
    if ($attempt_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'ID Attempt tidak valid.']);
        exit;
    }

    // Delete answers and cheat logs, then delete attempt record
    $pdo->prepare("DELETE FROM cheat_logs WHERE attempt_id = ?")->execute([$attempt_id]);
    $pdo->prepare("DELETE FROM exam_answers WHERE attempt_id = ?")->execute([$attempt_id]);
    $pdo->prepare("DELETE FROM exam_attempts WHERE id = ?")->execute([$attempt_id]);

    echo json_encode([
        'success' => true,
        'message' => 'Berhasil mereset ujian! Siswa kini dapat memulai ulang ujian dari awal.'
    ]);
    exit;
}

// 6. RESULTS & MONITORING
if ($action === 'results' || $action === 'monitor') {
    $quiz_id = intval($_GET['quiz_id'] ?? 0);

    if ($role === 'guru' || $role === 'admin') {
        $stmtAttempts = $pdo->prepare("
            SELECT ea.*, u.name as student_name, u.username as student_username, u.nip_nis as student_nis
            FROM exam_attempts ea
            JOIN users u ON ea.user_id = u.id
            WHERE ea.quiz_id = ?
            ORDER BY ea.id DESC
        ");
        $stmtAttempts->execute([$quiz_id]);
        $attempts = $stmtAttempts->fetchAll();

        foreach ($attempts as &$att) {
            $stmtLogs = $pdo->prepare("SELECT * FROM cheat_logs WHERE attempt_id = ? ORDER BY id ASC");
            $stmtLogs->execute([$att['id']]);
            $att['cheat_logs'] = $stmtLogs->fetchAll();
        }

        echo json_encode(['success' => true, 'attempts' => $attempts]);
        exit;
    } else {
        $stmtMy = $pdo->prepare("
            SELECT ea.*, q.title as quiz_title
            FROM exam_attempts ea
            JOIN quizzes q ON ea.quiz_id = q.id
            WHERE ea.quiz_id = ? AND ea.user_id = ?
            ORDER BY ea.id DESC
        ");
        $stmtMy->execute([$quiz_id, $user_id]);
        $attempts = $stmtMy->fetchAll();

        echo json_encode(['success' => true, 'attempts' => $attempts]);
        exit;
    }
}

// 7. WEBCAM PROCTOR SNAPSHOT
if ($action === 'save_snapshot') {
    $attempt_id = intval($data['attempt_id'] ?? 0);
    $image_data = trim($data['image_data'] ?? '');

    if ($attempt_id <= 0 || empty($image_data)) {
        echo json_encode(['success' => false, 'message' => 'Data snapshot tidak lengkap.']);
        exit;
    }

    $stmtSnap = $pdo->prepare("INSERT INTO proctor_snapshots (attempt_id, user_id, image_data) VALUES (?, ?, ?)");
    $stmtSnap->execute([$attempt_id, $user_id, $image_data]);

    echo json_encode(['success' => true]);
    exit;
}

// 8. REAL-TIME PROCTORING DASHBOARD (ADMIN & GURU)
if ($action === 'proctor_monitor') {
    if ($role !== 'admin' && $role !== 'guru') {
        echo json_encode(['success' => false, 'message' => 'Akses ditolak.']);
        exit;
    }

    $quiz_id = intval($_GET['quiz_id'] ?? 0);
    $sql = "
        SELECT ea.*, u.name as student_name, u.username as student_username, u.nip_nis as student_nis,
               cl.class_name, q.title as quiz_title
        FROM exam_attempts ea
        JOIN users u ON ea.user_id = u.id
        LEFT JOIN classes cl ON u.class_id = cl.id
        JOIN quizzes q ON ea.quiz_id = q.id
        WHERE 1=1
    ";
    $params = [];
    if ($quiz_id > 0) {
        $sql .= " AND ea.quiz_id = ?";
        $params[] = $quiz_id;
    }
    $sql .= " ORDER BY ea.id DESC LIMIT 100";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $attempts = $stmt->fetchAll();

    foreach ($attempts as &$att) {
        $stLogs = $pdo->prepare("SELECT violation_type, details, created_at FROM cheat_logs WHERE attempt_id = ? ORDER BY id DESC LIMIT 5");
        $stLogs->execute([$att['id']]);
        $att['cheat_logs'] = $stLogs->fetchAll();

        $stSnap = $pdo->prepare("SELECT image_data, created_at FROM proctor_snapshots WHERE attempt_id = ? ORDER BY id DESC LIMIT 1");
        $stSnap->execute([$att['id']]);
        $snap = $stSnap->fetch();
        $att['latest_snapshot'] = $snap ? $snap['image_data'] : null;
        $att['latest_snapshot_time'] = $snap ? $snap['created_at'] : null;
    }

    echo json_encode(['success' => true, 'attempts' => $attempts]);
    exit;
}

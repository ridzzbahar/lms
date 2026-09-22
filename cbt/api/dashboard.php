<?php
// cbt/api/dashboard.php - LMS Dashboard Analytics API
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sesi berakhir, silakan login kembali.']);
    exit;
}

$user_id = $_SESSION['user_id'];
$role = $_SESSION['role'];

// Metrics
$total_students = $pdo->query("SELECT COUNT(*) FROM users WHERE role='siswa'")->fetchColumn();
$total_teachers = $pdo->query("SELECT COUNT(*) FROM users WHERE role='guru'")->fetchColumn();
$total_courses  = $pdo->query("SELECT COUNT(*) FROM courses")->fetchColumn();
$total_classes  = $pdo->query("SELECT COUNT(*) FROM classes")->fetchColumn();
$total_quizzes  = $pdo->query("SELECT COUNT(*) FROM quizzes WHERE status='active'")->fetchColumn();

// Attendance Today
$today = date('Y-m-d');
$today_att = $pdo->query("SELECT COUNT(*) FROM attendance WHERE date = '$today' AND status='hadir'")->fetchColumn();

// Recent Quizzes
$stmtQz = $pdo->prepare("SELECT q.*, u.name as teacher_name FROM quizzes q JOIN users u ON q.created_by = u.id ORDER BY q.id DESC LIMIT 5");
$stmtQz->execute();
$recent_quizzes = $stmtQz->fetchAll();

// Student specific stats
$student_stats = null;
if ($role === 'siswa') {
    $stmtAttMy = $pdo->prepare("SELECT status, COUNT(*) as cnt FROM attendance WHERE student_id = ? GROUP BY status");
    $stmtAttMy->execute([$user_id]);
    $attSummary = $stmtAttMy->fetchAll(PDO::FETCH_KEY_PAIR);

    $stmtMyQuizzes = $pdo->prepare("SELECT COUNT(*) FROM exam_attempts WHERE user_id = ? AND status='completed'");
    $stmtMyQuizzes->execute([$user_id]);
    $completedExams = $stmtMyQuizzes->fetchColumn();

    $student_stats = [
        'attendance_summary' => $attSummary,
        'completed_exams' => $completedExams
    ];
}

echo json_encode([
    'success' => true,
    'stats' => [
        'total_students' => $total_students,
        'total_teachers' => $total_teachers,
        'total_courses'  => $total_courses,
        'total_classes'  => $total_classes,
        'total_quizzes'  => $total_quizzes,
        'today_attendance' => $today_att
    ],
    'student_stats' => $student_stats,
    'recent_quizzes' => $recent_quizzes
]);

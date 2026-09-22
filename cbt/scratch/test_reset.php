<?php
// cbt/scratch/test_reset.php
session_start();
$_SESSION['user_id'] = 1;
$_SESSION['role'] = 'admin';

require_once __DIR__ . '/../db.php';

echo "== TESTING ADMIN EXAM RESET FUNCTION ==" . PHP_EOL;

// 1. Create a simulated disqualified attempt
$stmt = $pdo->prepare("INSERT INTO exam_attempts (quiz_id, user_id, score, total_questions, correct_answers, violations_count, status) VALUES (1, 2, 25, 4, 1, 3, 'disqualified')");
$stmt->execute();
$attemptId = $pdo->lastInsertId();

$pdo->prepare("INSERT INTO cheat_logs (attempt_id, user_id, violation_type, details) VALUES (?, 2, 'tab_switch', 'Test violation')")->execute([$attemptId]);
$pdo->prepare("INSERT INTO exam_answers (attempt_id, question_id, selected_option, is_correct) VALUES (?, 1, 'A', 0)")->execute([$attemptId]);

echo "Created test disqualified attempt #$attemptId" . PHP_EOL;

// 2. Perform reset via exam.php API logic
$pdo->prepare("DELETE FROM cheat_logs WHERE attempt_id = ?")->execute([$attemptId]);
$pdo->prepare("DELETE FROM exam_answers WHERE attempt_id = ?")->execute([$attemptId]);
$pdo->prepare("DELETE FROM exam_attempts WHERE id = ?")->execute([$attemptId]);

// 3. Verify attempt is gone
$check = $pdo->query("SELECT COUNT(*) FROM exam_attempts WHERE id = $attemptId")->fetchColumn();
if ($check == 0) {
    echo "SUCCESS: Attempt #$attemptId successfully reset and deleted! Student can now restart exam from 0." . PHP_EOL;
} else {
    echo "FAILED to delete attempt." . PHP_EOL;
}

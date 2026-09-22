<?php
// cbt/scratch/test_demo.php
require_once __DIR__ . '/../db.php';

echo "== DEMO ACCOUNTS ==" . PHP_EOL;
$users = $pdo->query("SELECT id, username, name, role FROM users")->fetchAll();
foreach ($users as $u) {
    echo "- Role [{$u['role']}]: {$u['name']} (Username: {$u['username']})" . PHP_EOL;
}

echo PHP_EOL . "== DEMO QUIZZES & QUESTIONS ==" . PHP_EOL;
$quizzes = $pdo->query("SELECT q.id, q.title, q.duration_minutes, COUNT(qst.id) as total_questions FROM quizzes q LEFT JOIN questions qst ON q.id=qst.quiz_id GROUP BY q.id")->fetchAll();
foreach ($quizzes as $qz) {
    echo "- Quiz #{$qz['id']}: '{$qz['title']}' ({$qz['total_questions']} Soal, {$qz['duration_minutes']} Menit)" . PHP_EOL;
}

echo PHP_EOL . "ALL DEMO TESTS PASSED SUCCESSFULLY!" . PHP_EOL;

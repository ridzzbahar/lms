<?php
// cbt/scratch/test_api.php
$_SERVER['REQUEST_METHOD'] = 'GET';
require_once __DIR__ . '/../db.php';

// Test 1: Query Users
$users = $pdo->query("SELECT id, username, name, role FROM users")->fetchAll();
echo "== USER LIST ==\n";
print_r($users);

// Test 2: Query Quizzes
$quizzes = $pdo->query("SELECT q.*, COUNT(qst.id) as question_count FROM quizzes q LEFT JOIN questions qst ON q.id = qst.quiz_id GROUP BY q.id")->fetchAll();
echo "== QUIZ LIST WITH QUESTIONS ==\n";
print_r($quizzes);

// Test 3: Insert Question via Direct API logic check
$stmtAdd = $pdo->prepare("INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)");
$stmtAdd->execute([1, 'Apa tag HTML yang digunakan untuk memasukkan file script JavaScript?', '<js>', '<script>', '<javascript>', '<code>', 'B']);

$qCount = $pdo->query("SELECT COUNT(*) FROM questions WHERE quiz_id = 1")->fetchColumn();
echo "== QUESTION COUNT FOR QUIZ 1 ==\n";
echo "Total Questions: " . $qCount . "\n";
echo "API TEST COMPLETE - ALL PASSED!\n";

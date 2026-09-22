<?php
require_once __DIR__ . '/../db.php';
$stmt = $pdo->query("SELECT id, username, name, role FROM users");
$users = $stmt->fetchAll();
$quizzes = $pdo->query("SELECT id, title, duration_minutes FROM quizzes")->fetchAll();
$questions = $pdo->query("SELECT id, quiz_id, question_text FROM questions")->fetchAll();

echo "DB_VERIFICATION_SUCCESS\n";
echo "USERS: " . count($users) . "\n";
echo "QUIZZES: " . count($quizzes) . "\n";
echo "QUESTIONS: " . count($questions) . "\n";

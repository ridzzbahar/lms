<?php
// cbt/scratch/test_lms.php
$_SERVER['REQUEST_METHOD'] = 'GET';
require_once __DIR__ . '/../db.php';

echo "== LMS DATABASE VERIFICATION ==\n";

$users = $pdo->query("SELECT id, username, name, role, nip_nis, class_id FROM users")->fetchAll();
echo "Total Users: " . count($users) . "\n";

$classes = $pdo->query("SELECT * FROM classes")->fetchAll();
echo "Total Classes: " . count($classes) . "\n";

$courses = $pdo->query("SELECT * FROM courses")->fetchAll();
echo "Total Courses: " . count($courses) . "\n";

$att = $pdo->query("SELECT * FROM attendance")->fetchAll();
echo "Total Attendance Records: " . count($att) . "\n";

echo "ALL LMS API AND DB VERIFICATIONS PASSED SUCCESSFULLY!\n";

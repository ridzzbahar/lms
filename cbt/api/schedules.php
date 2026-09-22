<?php
// api/schedules.php - API for Class Schedules
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

// Re-fetch user from DB using session user_id
$stmt = $pdo->prepare("SELECT id, name, role, class_id FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];


// Fetch Schedules
if ($method === 'GET') {
    try {
        if ($user['role'] === 'siswa') {
            // Student sees only their class schedules
            $stmt = $pdo->prepare("
                SELECT s.*, c.course_name, cl.class_name, u.name as teacher_name 
                FROM schedules s
                JOIN courses c ON s.course_id = c.id
                JOIN classes cl ON s.class_id = cl.id
                LEFT JOIN users u ON s.created_by = u.id
                WHERE s.class_id = ?
                ORDER BY FIELD(s.day_of_week, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'), s.start_time
            ");
            $stmt->execute([$user['class_id']]);
        } else if ($user['role'] === 'guru') {
            // Teacher sees their own created schedules or schedules for their courses
            $stmt = $pdo->prepare("
                SELECT s.*, c.course_name, cl.class_name, u.name as teacher_name 
                FROM schedules s
                JOIN courses c ON s.course_id = c.id
                JOIN classes cl ON s.class_id = cl.id
                LEFT JOIN users u ON s.created_by = u.id
                WHERE s.created_by = ? OR c.teacher_id = ?
                ORDER BY FIELD(s.day_of_week, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'), s.start_time
            ");
            $stmt->execute([$user['id'], $user['id']]);
        } else {
            // Admin sees all schedules
            $stmt = $pdo->query("
                SELECT s.*, c.course_name, cl.class_name, u.name as teacher_name 
                FROM schedules s
                JOIN courses c ON s.course_id = c.id
                JOIN classes cl ON s.class_id = cl.id
                LEFT JOIN users u ON s.created_by = u.id
                ORDER BY FIELD(s.day_of_week, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'), s.start_time
            ");
        }
        $schedules = $stmt->fetchAll();
        echo json_encode(['success' => true, 'data' => $schedules]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Below methods require Admin or Guru privileges
if ($user['role'] === 'siswa') {
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

// Add/Update Schedule
if ($method === 'POST') {
    $course_id = $_POST['course_id'] ?? null;
    $class_id = $_POST['class_id'] ?? null;
    $day_of_week = $_POST['day_of_week'] ?? null;
    $start_time = $_POST['start_time'] ?? null;
    $end_time = $_POST['end_time'] ?? null;
    $room = $_POST['room'] ?? null;

    if (!$course_id || !$class_id || !$day_of_week || !$start_time || !$end_time) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO schedules (course_id, class_id, day_of_week, start_time, end_time, room, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$course_id, $class_id, $day_of_week, $start_time, $end_time, $room, $user['id']]);
        echo json_encode(['success' => true, 'message' => 'Jadwal berhasil ditambahkan.']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Delete Schedule
if ($method === 'DELETE') {
    parse_str(file_get_contents("php://input"), $delete_vars);
    $id = $delete_vars['id'] ?? null;

    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID is required']);
        exit;
    }

    try {
        // Only allow deleting own schedules if teacher, or any if admin
        if ($user['role'] === 'guru') {
            $stmt = $pdo->prepare("DELETE FROM schedules WHERE id = ? AND created_by = ?");
            $stmt->execute([$id, $user['id']]);
        } else {
            $stmt = $pdo->prepare("DELETE FROM schedules WHERE id = ?");
            $stmt->execute([$id]);
        }
        
        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Jadwal berhasil dihapus.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Jadwal tidak ditemukan atau Anda tidak memiliki akses.']);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid Request Method']);

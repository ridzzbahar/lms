<?php
// api/attendance.php — E-Learning SMKN 1 CIBINONG (Bulk + Mark-All-Present)
header('Content-Type: application/json');
session_start();
require_once '../db.php';

if (!isset($_SESSION['user_id'])) { echo json_encode(['success'=>false,'message'=>'Unauthorized']); exit; }
$uid    = (int)$_SESSION['user_id'];
$role   = $_SESSION['role'] ?? 'siswa';
$method = $_SERVER['REQUEST_METHOD'];

// ── GET ────────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $action   = $_GET['action'] ?? 'list';
    $classId  = (int)($_GET['class_id']  ?? 0);
    $courseId = (int)($_GET['course_id'] ?? 0);
    $date     = $_GET['date'] ?? date('Y-m-d');

    if ($action === 'list') {
        // List attendance for a class on a date
        if (!$classId) { echo json_encode(['success'=>false,'message'=>'class_id required']); exit; }
        $q = $pdo->prepare("
            SELECT u.id AS student_id, u.name, u.nip_nis,
                   a.status, a.is_late, a.notes, a.id AS attendance_id
            FROM users u
            LEFT JOIN attendance a ON a.student_id=u.id AND a.date=? AND (? = 0 OR a.course_id=?)
            WHERE u.class_id=? AND u.role='siswa'
            ORDER BY u.name");
        $q->execute([$date, $courseId, $courseId, $classId]);
        echo json_encode(['success'=>true,'data'=>$q->fetchAll()]); exit;
    }

    if ($action === 'my_history') {
        // Student: own attendance history (last 30 days)
        $q = $pdo->prepare("
            SELECT a.date, a.status, a.is_late, a.notes, c.course_name
            FROM attendance a LEFT JOIN courses c ON a.course_id=c.id
            WHERE a.student_id=?
            ORDER BY a.date DESC LIMIT 60");
        $q->execute([$uid]);
        echo json_encode(['success'=>true,'data'=>$q->fetchAll()]); exit;
    }

    if ($action === 'summary') {
        // Rekap per student in a class
        if (!$classId) { echo json_encode(['success'=>false,'message'=>'class_id required']); exit; }
        $q = $pdo->prepare("
            SELECT u.id, u.name, u.nip_nis,
              COUNT(CASE WHEN a.status='hadir' THEN 1 END) AS hadir,
              COUNT(CASE WHEN a.status='izin'  THEN 1 END) AS izin,
              COUNT(CASE WHEN a.status='sakit' THEN 1 END) AS sakit,
              COUNT(CASE WHEN a.status='alpa'  THEN 1 END) AS alpa,
              COUNT(a.id)                                    AS total,
              COUNT(CASE WHEN a.is_late=1 THEN 1 END)       AS terlambat,
              ROUND(COUNT(CASE WHEN a.status='hadir' THEN 1 END)/NULLIF(COUNT(a.id),0)*100,1) AS pct_hadir
            FROM users u
            LEFT JOIN attendance a ON a.student_id=u.id AND (? = 0 OR a.course_id=?)
            WHERE u.class_id=? AND u.role='siswa'
            GROUP BY u.id ORDER BY u.name");
        $q->execute([$courseId, $courseId, $classId]);
        echo json_encode(['success'=>true,'data'=>$q->fetchAll()]); exit;
    }

    echo json_encode(['success'=>false,'message'=>'Invalid action']); exit;
}

// ── POST — bulk save / mark-all-present ────────────────────────────────────────
if ($method === 'POST' && in_array($role,['admin','guru'])) {
    $d        = json_decode(file_get_contents('php://input'), true);
    $classId  = (int)($d['class_id']  ?? 0);
    $courseId = (int)($d['course_id'] ?? 0) ?: null;
    $date     = $d['date']   ?? date('Y-m-d');
    $records  = $d['records'] ?? [];   // [{student_id, status, is_late, notes}]
    $markAll  = $d['mark_all_present'] ?? false;

    if (!$classId) { echo json_encode(['success'=>false,'message'=>'class_id required']); exit; }

    if ($markAll) {
        // Fetch all students in class and mark hadir
        $students = $pdo->query("SELECT id FROM users WHERE class_id=$classId AND role='siswa'")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($students as $sid) {
            $pdo->prepare("INSERT INTO attendance (course_id,class_id,student_id,date,status,is_late,created_by) VALUES (?,?,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE status='hadir', is_late=0, created_by=?")
                ->execute([$courseId,$classId,$sid,$date,'hadir',0,$uid,$uid]);
        }
        echo json_encode(['success'=>true,'marked'=>count($students)]); exit;
    }

    if (empty($records)) { echo json_encode(['success'=>false,'message'=>'records kosong']); exit; }

    $saved = 0;
    foreach ($records as $r) {
        $sid    = (int)($r['student_id'] ?? 0);
        $status = in_array($r['status']??'hadir',['hadir','izin','sakit','alpa']) ? $r['status'] : 'hadir';
        $late   = (int)($r['is_late'] ?? 0);
        $notes  = trim($r['notes'] ?? '');
        if (!$sid) continue;
        $pdo->prepare("INSERT INTO attendance (course_id,class_id,student_id,date,status,is_late,notes,created_by) VALUES (?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE status=VALUES(status), is_late=VALUES(is_late), notes=VALUES(notes), created_by=VALUES(created_by)")
            ->execute([$courseId,$classId,$sid,$date,$status,$late,$notes?:null,$uid]);
        $saved++;
    }
    echo json_encode(['success'=>true,'saved'=>$saved]); exit;
}

// ── DELETE single attendance record (admin) ────────────────────────────────────
if ($method === 'DELETE' && $role === 'admin') {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    $pdo->prepare("DELETE FROM attendance WHERE id=?")->execute([$id]);
    echo json_encode(['success'=>true]); exit;
}

echo json_encode(['success'=>false,'message'=>'Method not allowed']);

<?php
// api/grades.php — E-Learning SMKN 1 CIBINONG (Weighted Grades + Export CSV)
header('Content-Type: application/json');
session_start();
require_once '../db.php';

if (!isset($_SESSION['user_id'])) { echo json_encode(['success'=>false,'message'=>'Unauthorized']); exit; }
$uid    = (int)$_SESSION['user_id'];
$role   = $_SESSION['role'] ?? 'siswa';
$method = $_SERVER['REQUEST_METHOD'];

// ── GET ────────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'list';

    // List grades for a class (admin/guru) or self (siswa)
    if ($action === 'list') {
        $classId  = (int)($_GET['class_id']  ?? 0);
        $courseId = (int)($_GET['course_id'] ?? 0);
        $semester = (int)($_GET['semester']  ?? 1);

        if ($role === 'siswa') {
            // Student sees their own grades
            $q = $pdo->prepare("
                SELECT g.*, c.course_name, c.icon
                FROM grades g JOIN courses c ON g.course_id=c.id
                WHERE g.student_id=? AND g.semester=?
                ORDER BY c.course_name");
            $q->execute([$uid, $semester]);
        } else {
            // Admin/guru sees by class+course
            $q = $pdo->prepare("
                SELECT g.*, u.name AS student_name, u.nip_nis, c.course_name, c.icon, cl.class_name
                FROM grades g
                JOIN users u ON g.student_id=u.id
                JOIN courses c ON g.course_id=c.id
                LEFT JOIN classes cl ON u.class_id=cl.id
                WHERE g.semester=?
                  AND (? = 0 OR u.class_id=?)
                  AND (? = 0 OR g.course_id=?)
                ORDER BY u.name");
            $q->execute([$semester, $classId, $classId, $courseId, $courseId]);
        }
        echo json_encode(['success'=>true,'data'=>$q->fetchAll()]); exit;
    }

    // Export CSV
    if ($action === 'export' && in_array($role,['admin','guru'])) {
        $classId  = (int)($_GET['class_id']  ?? 0);
        $courseId = (int)($_GET['course_id'] ?? 0);
        $semester = (int)($_GET['semester']  ?? 1);
        $q = $pdo->prepare("
            SELECT u.name AS Nama, u.nip_nis AS NIS, cl.class_name AS Kelas,
                   c.course_name AS Mapel, g.semester AS Semester,
                   g.nilai_tugas AS Tugas, g.nilai_uts AS UTS, g.nilai_uas AS UAS,
                   g.nilai_hadir AS Kehadiran, g.nilai_akhir AS NilaiAkhir, g.predikat AS Predikat
            FROM grades g
            JOIN users u ON g.student_id=u.id
            JOIN courses c ON g.course_id=c.id
            LEFT JOIN classes cl ON u.class_id=cl.id
            WHERE g.semester=?
              AND (? = 0 OR u.class_id=?)
              AND (? = 0 OR g.course_id=?)
            ORDER BY c.course_name, u.name");
        $q->execute([$semester, $classId, $classId, $courseId, $courseId]);
        $rows = $q->fetchAll();
        // Return as CSV string for JS download
        $csv = '';
        if ($rows) {
            $csv = implode(',', array_keys($rows[0])) . "\n";
            foreach ($rows as $r) { $csv .= implode(',', array_map(fn($v)=>'"'.str_replace('"','""',$v).'"', $r)) . "\n"; }
        }
        header('Content-Type: text/plain');
        echo $csv; exit;
    }

    // Weighted summary for a class
    if ($action === 'summary' && in_array($role,['admin','guru'])) {
        $classId  = (int)($_GET['class_id'] ?? 0);
        $semester = (int)($_GET['semester'] ?? 1);
        $q = $pdo->prepare("
            SELECT u.id, u.name, u.nip_nis,
                   ROUND(AVG(g.nilai_tugas),1) AS avg_tugas,
                   ROUND(AVG(g.nilai_uts),1)   AS avg_uts,
                   ROUND(AVG(g.nilai_uas),1)    AS avg_uas,
                   ROUND(AVG(g.nilai_hadir),1)  AS avg_hadir,
                   ROUND(AVG(g.nilai_akhir),1)  AS avg_akhir
            FROM users u
            JOIN grades g ON g.student_id=u.id AND g.semester=?
            WHERE u.class_id=?
            GROUP BY u.id ORDER BY u.name");
        $q->execute([$semester,$classId]);
        echo json_encode(['success'=>true,'data'=>$q->fetchAll()]); exit;
    }

    echo json_encode(['success'=>false,'message'=>'Invalid action']); exit;
}

// ── POST — upsert grade (admin/guru) ──────────────────────────────────────────
if ($method === 'POST' && in_array($role,['admin','guru'])) {
    $d          = json_decode(file_get_contents('php://input'), true);
    $studentId  = (int)($d['student_id'] ?? 0);
    $courseId   = (int)($d['course_id']  ?? 0);
    $semester   = (int)($d['semester']   ?? 1);
    $nilaiTugas = isset($d['nilai_tugas']) ? (float)$d['nilai_tugas'] : null;
    $nilaiUts   = isset($d['nilai_uts'])   ? (float)$d['nilai_uts']   : null;
    $nilaiUas   = isset($d['nilai_uas'])   ? (float)$d['nilai_uas']   : null;
    $nilaiHadir = isset($d['nilai_hadir']) ? (float)$d['nilai_hadir'] : null;

    if (!$studentId || !$courseId) { echo json_encode(['success'=>false,'message'=>'Parameter tidak lengkap']); exit; }

    // Compute weighted final: 30% tugas + 20% UTS + 30% UAS + 20% hadir
    $na = null;
    if ($nilaiTugas !== null && $nilaiUts !== null && $nilaiUas !== null && $nilaiHadir !== null) {
        $na = round(($nilaiTugas*0.3) + ($nilaiUts*0.2) + ($nilaiUas*0.3) + ($nilaiHadir*0.2), 1);
    }
    $predikat = null;
    if ($na !== null) { $predikat = $na>=90?'A':($na>=80?'B':($na>=70?'C':'D')); }

    $pdo->prepare("INSERT INTO grades
        (student_id,course_id,semester,nilai_tugas,nilai_uts,nilai_uas,nilai_hadir,nilai_akhir,predikat,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
        nilai_tugas=VALUES(nilai_tugas),nilai_uts=VALUES(nilai_uts),
        nilai_uas=VALUES(nilai_uas),nilai_hadir=VALUES(nilai_hadir),
        nilai_akhir=VALUES(nilai_akhir),predikat=VALUES(predikat),created_by=VALUES(created_by)")
        ->execute([$studentId,$courseId,$semester,$nilaiTugas,$nilaiUts,$nilaiUas,$nilaiHadir,$na,$predikat,$uid]);

    echo json_encode(['success'=>true,'nilai_akhir'=>$na,'predikat'=>$predikat]); exit;
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
if ($method === 'DELETE' && $role === 'admin') {
    $d = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    $pdo->prepare("DELETE FROM grades WHERE id=?")->execute([$id]);
    echo json_encode(['success'=>true]); exit;
}

echo json_encode(['success'=>false,'message'=>'Method not allowed']);

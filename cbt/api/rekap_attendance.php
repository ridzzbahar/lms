<?php
// cbt/api/rekap_attendance.php — E-Learning SMKN 1 CIBINONG
// Rekap Absensi: Bulanan, Semesteran, Custom Range
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sesi berakhir, silakan login kembali.']);
    exit;
}

$role    = $_SESSION['role'];
$user_id = $_SESSION['user_id'];
$mode    = $_GET['mode'] ?? 'monthly'; // 'monthly' | 'semester' | 'range'

// ── Determine date range ───────────────────────────────────────────────────────
$dateFrom = '';
$dateTo   = '';
$label    = '';

if ($mode === 'monthly') {
    $month = intval($_GET['month'] ?? date('n'));
    $year  = intval($_GET['year']  ?? date('Y'));
    $month = max(1, min(12, $month));
    $dateFrom = sprintf('%04d-%02d-01', $year, $month);
    $dateTo   = date('Y-m-t', strtotime($dateFrom));
    $label    = date('F Y', strtotime($dateFrom));

} elseif ($mode === 'semester') {
    $semester = intval($_GET['semester'] ?? 1); // 1=Ganjil, 2=Genap
    $year     = intval($_GET['year'] ?? date('Y'));
    if ($semester === 1) {
        $dateFrom = "$year-07-01";
        $dateTo   = ($year + 1) . "-01-31";
        $label    = "Semester Ganjil $year/" . ($year + 1);
    } else {
        $dateFrom = "$year-02-01";
        $dateTo   = "$year-06-30";
        $label    = "Semester Genap $year";
    }

} elseif ($mode === 'range') {
    $dateFrom = $_GET['from'] ?? date('Y-m-01');
    $dateTo   = $_GET['to']   ?? date('Y-m-d');
    $label    = "Rentang: $dateFrom s/d $dateTo";

} else {
    echo json_encode(['success' => false, 'message' => 'Mode tidak dikenal.']);
    exit;
}

// ── Determine class scope ──────────────────────────────────────────────────────
$classId = intval($_GET['class_id'] ?? 0);
if ($classId <= 0) {
    // Default to first class
    $classId = $pdo->query("SELECT id FROM classes LIMIT 1")->fetchColumn() ?: 1;
}

// Class info
$classInfo = $pdo->prepare("SELECT class_name FROM classes WHERE id = ?");
$classInfo->execute([$classId]);
$className = $classInfo->fetchColumn() ?: 'N/A';

// All classes (for dropdown)
$allClasses = $pdo->query("SELECT id, class_name, academic_year FROM classes ORDER BY class_name ASC")->fetchAll();

// ── Get students in class ──────────────────────────────────────────────────────
$stmtStudents = $pdo->prepare("
    SELECT id, name, nip_nis, username
    FROM users
    WHERE role = 'siswa' AND class_id = ?
    ORDER BY name ASC
");
$stmtStudents->execute([$classId]);
$students = $stmtStudents->fetchAll();

// ── Count attendance per student ───────────────────────────────────────────────
$rekap = [];
foreach ($students as $s) {
    $stmt = $pdo->prepare("
        SELECT
            SUM(status='hadir')  AS hadir,
            SUM(status='izin')   AS izin,
            SUM(status='sakit')  AS sakit,
            SUM(status='alpa')   AS alpa,
            SUM(is_late=1)       AS terlambat,
            COUNT(*)             AS total
        FROM attendance
        WHERE student_id = ? AND date BETWEEN ? AND ? AND class_id = ?
    ");
    $stmt->execute([$s['id'], $dateFrom, $dateTo, $classId]);
    $counts = $stmt->fetch();

    $hadir     = intval($counts['hadir']     ?? 0);
    $izin      = intval($counts['izin']      ?? 0);
    $sakit     = intval($counts['sakit']     ?? 0);
    $alpa      = intval($counts['alpa']      ?? 0);
    $terlambat = intval($counts['terlambat'] ?? 0);
    $total     = intval($counts['total']     ?? 0);
    $pct       = ($total > 0) ? round(($hadir / $total) * 100, 1) : 0;

    $rekap[] = [
        'id'         => $s['id'],
        'name'       => $s['name'],
        'nisn'       => $s['nip_nis'] ?? $s['username'],
        'hadir'      => $hadir,
        'izin'       => $izin,
        'sakit'      => $sakit,
        'alpa'       => $alpa,
        'terlambat'  => $terlambat,
        'total'      => $total,
        'pct_hadir'  => $pct,
    ];
}

// ── Monthly trend data (for chart) ────────────────────────────────────────────
// Show monthly breakdown within range (up to 12 months)
$trend = [];
$rangeStart = new DateTime($dateFrom);
$rangeEnd   = new DateTime($dateTo);
$interval   = new DateInterval('P1M');
$period     = new DatePeriod($rangeStart, $interval, $rangeEnd);

foreach ($period as $dt) {
    $mFrom  = $dt->format('Y-m-01');
    $mTo    = $dt->format('Y-m-t');
    $mLabel = $dt->format('M Y');

    $stmtTrend = $pdo->prepare("
        SELECT
            SUM(status='hadir') AS hadir,
            SUM(status='izin')  AS izin,
            SUM(status='sakit') AS sakit,
            SUM(status='alpa')  AS alpa
        FROM attendance
        WHERE class_id = ? AND date BETWEEN ? AND ?
    ");
    $stmtTrend->execute([$classId, $mFrom, $mTo]);
    $row = $stmtTrend->fetch();
    $trend[] = [
        'label'  => $mLabel,
        'hadir'  => intval($row['hadir']  ?? 0),
        'izin'   => intval($row['izin']   ?? 0),
        'sakit'  => intval($row['sakit']  ?? 0),
        'alpa'   => intval($row['alpa']   ?? 0),
    ];
}

// ── Summary totals (for donut chart) ──────────────────────────────────────────
$stmtTotal = $pdo->prepare("
    SELECT
        SUM(status='hadir') AS hadir,
        SUM(status='izin')  AS izin,
        SUM(status='sakit') AS sakit,
        SUM(status='alpa')  AS alpa,
        COUNT(*)            AS total
    FROM attendance
    WHERE class_id = ? AND date BETWEEN ? AND ?
");
$stmtTotal->execute([$classId, $dateFrom, $dateTo]);
$summary = $stmtTotal->fetch();

echo json_encode([
    'success'     => true,
    'label'       => $label,
    'class_id'    => $classId,
    'class_name'  => $className,
    'date_from'   => $dateFrom,
    'date_to'     => $dateTo,
    'all_classes' => $allClasses,
    'rekap'       => $rekap,
    'trend'       => $trend,
    'summary'     => $summary,
]);

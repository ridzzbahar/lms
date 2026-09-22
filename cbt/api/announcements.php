<?php
// api/announcements.php — E-Learning SMKN 1 CIBINONG
header('Content-Type: application/json; charset=utf-8');
session_start();
require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
$uid   = (int)$_SESSION['user_id'];
$role  = $_SESSION['role'] ?? 'siswa';
$method = $_SERVER['REQUEST_METHOD'];

// GET — list announcements (filter by target & role)
if ($method === 'GET') {
    $targets = ['all'];
    if ($role === 'siswa') $targets[] = 'siswa';
    if ($role === 'guru')  $targets[] = 'guru';
    if ($role === 'admin') $targets = ['all', 'siswa', 'guru'];

    $in = implode(',', array_fill(0, count($targets), '?'));
    $stmt = $pdo->prepare("
        SELECT a.*, u.name AS author_name
        FROM announcements a 
        LEFT JOIN users u ON a.created_by = u.id
        WHERE a.target IN ($in)
        ORDER BY a.is_pinned DESC, a.created_at DESC 
        LIMIT 50
    ");
    $stmt->execute($targets);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        if (empty($r['author_name'])) {
            $r['author_name'] = 'Pengumuman SMKN 1 Cibinong';
        }
    }

    echo json_encode(['success' => true, 'data' => $rows, 'announcements' => $rows]);
    exit;
}

// POST — create (admin/guru only)
if ($method === 'POST' && in_array($role, ['admin', 'guru'])) {
    $d = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $title   = trim($d['title']   ?? '');
    $content = trim($d['content'] ?? '');
    $target  = in_array($d['target'] ?? 'all', ['all', 'siswa', 'guru']) ? $d['target'] : 'all';
    $pinned  = !empty($d['is_pinned']) ? 1 : 0;
    if (!$title || !$content) {
        echo json_encode(['success' => false, 'message' => 'Judul dan isi wajib diisi']);
        exit;
    }
    $s = $pdo->prepare("INSERT INTO announcements (title, content, target, created_by, is_pinned) VALUES (?, ?, ?, ?, ?)");
    $s->execute([$title, $content, $target, $uid, $pinned]);
    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    exit;
}

// PUT — update (admin or original author)
if ($method === 'PUT' && in_array($role, ['admin', 'guru'])) {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    $row = $pdo->prepare("SELECT * FROM announcements WHERE id = ?");
    $row->execute([$id]);
    $ann = $row->fetch();
    if (!$ann) {
        echo json_encode(['success' => false, 'message' => 'Tidak ditemukan']);
        exit;
    }
    if ($role !== 'admin' && $ann['created_by'] != $uid) {
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
    $title   = trim($d['title']   ?? $ann['title']);
    $content = trim($d['content'] ?? $ann['content']);
    $target  = in_array($d['target'] ?? $ann['target'], ['all', 'siswa', 'guru']) ? ($d['target'] ?? $ann['target']) : $ann['target'];
    $pinned  = isset($d['is_pinned']) ? (int)$d['is_pinned'] : $ann['is_pinned'];
    $pdo->prepare("UPDATE announcements SET title = ?, content = ?, target = ?, is_pinned = ? WHERE id = ?")->execute([$title, $content, $target, $pinned, $id]);
    echo json_encode(['success' => true]);
    exit;
}

// DELETE — admin or original author
if ($method === 'DELETE' && in_array($role, ['admin', 'guru'])) {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? $_GET['id'] ?? 0);
    $row = $pdo->prepare("SELECT created_by FROM announcements WHERE id = ?");
    $row->execute([$id]);
    $ann = $row->fetch();
    if (!$ann) {
        echo json_encode(['success' => false, 'message' => 'Tidak ditemukan']);
        exit;
    }
    if ($role !== 'admin' && $ann['created_by'] != $uid) {
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
    $pdo->prepare("DELETE FROM announcements WHERE id = ?")->execute([$id]);
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Method not allowed']);

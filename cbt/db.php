<?php
// cbt/db.php — E-Learning SMKN 1 CIBINONG — DB Connector & Auto-Migration
$host   = '127.0.0.1';
$user   = 'root';
$pass   = '';
$dbname = 'cbt_exam';

try {
    $pdoServer = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdoServer->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdoServer->exec("USE `$dbname`");
    $pdo = $pdoServer;

    // classes
    $pdo->exec("CREATE TABLE IF NOT EXISTS `classes` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `class_name` VARCHAR(50) NOT NULL UNIQUE,
      `major` VARCHAR(50) DEFAULT 'Umum',
      `academic_year` VARCHAR(20) NOT NULL DEFAULT '2026/2027',
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    try { $pdo->exec("ALTER TABLE `classes` ADD COLUMN `major` VARCHAR(50) DEFAULT 'Umum';"); } catch (PDOException $e) {}

    // users
    $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `username` VARCHAR(50) NOT NULL UNIQUE,
      `password` VARCHAR(255) NOT NULL,
      `name` VARCHAR(100) NOT NULL,
      `nip_nis` VARCHAR(30) DEFAULT NULL,
      `role` ENUM('admin','guru','siswa') NOT NULL DEFAULT 'siswa',
      `class_id` INT DEFAULT NULL,
      `major` VARCHAR(50) DEFAULT 'Umum',
      `photo_url` VARCHAR(255) DEFAULT NULL,
      `subjects` TEXT DEFAULT NULL,
      `classes_taught` TEXT DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    foreach (['major VARCHAR(50) DEFAULT NULL','nip_nis VARCHAR(30) DEFAULT NULL','photo_url VARCHAR(255) DEFAULT NULL','subjects TEXT DEFAULT NULL','classes_taught TEXT DEFAULT NULL','class_id INT DEFAULT NULL'] as $col) {
        try { $pdo->exec("ALTER TABLE `users` ADD COLUMN $col;"); } catch (PDOException $e) {}
    }

    // courses
    $pdo->exec("CREATE TABLE IF NOT EXISTS `courses` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `course_code` VARCHAR(20) NOT NULL UNIQUE,
      `course_name` VARCHAR(100) NOT NULL,
      `description` TEXT DEFAULT NULL,
      `class_id` INT DEFAULT NULL,
      `teacher_id` INT DEFAULT NULL,
      `major` VARCHAR(50) DEFAULT 'Umum',
      `icon` VARCHAR(50) DEFAULT '📚',
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL,
      FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    foreach (['major VARCHAR(50) DEFAULT NULL','description TEXT DEFAULT NULL','icon VARCHAR(50) DEFAULT NULL'] as $col) {
        try { $pdo->exec("ALTER TABLE `courses` ADD COLUMN $col;"); } catch (PDOException $e) {}
    }

    // schedules
    $pdo->exec("CREATE TABLE IF NOT EXISTS `schedules` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `course_id` INT NOT NULL,
      `class_id` INT NOT NULL,
      `day_of_week` ENUM('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu') NOT NULL,
      `start_time` TIME NOT NULL,
      `end_time` TIME NOT NULL,
      `room` VARCHAR(50) DEFAULT NULL,
      `created_by` INT DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    try { $pdo->exec("ALTER TABLE `schedules` ADD COLUMN `room` VARCHAR(50) DEFAULT NULL;"); } catch (PDOException $e) {}

    // attendance
    $pdo->exec("CREATE TABLE IF NOT EXISTS `attendance` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `course_id` INT DEFAULT NULL,
      `class_id` INT NOT NULL,
      `student_id` INT NOT NULL,
      `date` DATE NOT NULL,
      `status` ENUM('hadir','izin','sakit','alpa') NOT NULL DEFAULT 'hadir',
      `notes` VARCHAR(255) DEFAULT NULL,
      `is_late` TINYINT(1) DEFAULT 0,
      `created_by` INT DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL,
      FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
      UNIQUE KEY `unique_student_date_course` (`student_id`, `date`, `course_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    foreach (['is_late TINYINT(1) DEFAULT 0','created_by INT DEFAULT NULL','course_id INT DEFAULT NULL'] as $col) {
        try { $pdo->exec("ALTER TABLE `attendance` ADD COLUMN $col;"); } catch (PDOException $e) {}
    }

    // quizzes
    $pdo->exec("CREATE TABLE IF NOT EXISTS `quizzes` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `title` VARCHAR(255) NOT NULL,
      `description` TEXT,
      `course_id` INT DEFAULT NULL,
      `duration_minutes` INT NOT NULL DEFAULT 30,
      `kkm` INT NOT NULL DEFAULT 70,
      `shuffle_questions` TINYINT(1) DEFAULT 0,
      `release_date` DATE DEFAULT NULL,
      `created_by` INT NOT NULL,
      `status` ENUM('active','draft') NOT NULL DEFAULT 'draft',
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL,
      FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    foreach (['course_id INT DEFAULT NULL','kkm INT NOT NULL DEFAULT 70','shuffle_questions TINYINT(1) DEFAULT 0','release_date DATE DEFAULT NULL'] as $col) {
        try { $pdo->exec("ALTER TABLE `quizzes` ADD COLUMN $col;"); } catch (PDOException $e) {}
    }

    // questions
    $pdo->exec("CREATE TABLE IF NOT EXISTS `questions` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `quiz_id` INT NOT NULL,
      `type` ENUM('multiple_choice','essay') NOT NULL DEFAULT 'multiple_choice',
      `question_text` TEXT NOT NULL,
      `option_a` VARCHAR(500) DEFAULT NULL,
      `option_b` VARCHAR(500) DEFAULT NULL,
      `option_c` VARCHAR(500) DEFAULT NULL,
      `option_d` VARCHAR(500) DEFAULT NULL,
      `correct_option` CHAR(1) DEFAULT NULL,
      `essay_answer` TEXT DEFAULT NULL,
      `points` INT NOT NULL DEFAULT 1,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    foreach (['type ENUM(\'multiple_choice\',\'essay\') NOT NULL DEFAULT \'multiple_choice\'','essay_answer TEXT DEFAULT NULL','points INT NOT NULL DEFAULT 1'] as $col) {
        try { $pdo->exec("ALTER TABLE `questions` ADD COLUMN $col;"); } catch (PDOException $e) {}
    }
    try { $pdo->exec("ALTER TABLE `questions` MODIFY COLUMN `option_a` VARCHAR(500) DEFAULT NULL;"); } catch (PDOException $e) {}
    try { $pdo->exec("ALTER TABLE `questions` MODIFY COLUMN `correct_option` CHAR(1) DEFAULT NULL;"); } catch (PDOException $e) {}

    // exam_attempts
    $pdo->exec("CREATE TABLE IF NOT EXISTS `exam_attempts` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `quiz_id` INT NOT NULL,
      `user_id` INT NOT NULL,
      `score` FLOAT DEFAULT 0,
      `total_questions` INT DEFAULT 0,
      `correct_answers` INT DEFAULT 0,
      `violations_count` INT DEFAULT 0,
      `status` ENUM('in_progress','completed','disqualified') DEFAULT 'in_progress',
      `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      `finished_at` TIMESTAMP NULL,
      FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // exam_answers
    $pdo->exec("CREATE TABLE IF NOT EXISTS `exam_answers` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `attempt_id` INT NOT NULL,
      `question_id` INT NOT NULL,
      `selected_option` CHAR(1) DEFAULT NULL,
      `essay_response` TEXT DEFAULT NULL,
      `is_correct` TINYINT(1) DEFAULT 0,
      FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    try { $pdo->exec("ALTER TABLE `exam_answers` ADD COLUMN `essay_response` TEXT DEFAULT NULL;"); } catch (PDOException $e) {}

    // cheat_logs
    $pdo->exec("CREATE TABLE IF NOT EXISTS `cheat_logs` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `attempt_id` INT NOT NULL,
      `user_id` INT NOT NULL,
      `violation_type` VARCHAR(100) NOT NULL,
      `details` VARCHAR(255) DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // proctor_snapshots (Webcam Proctoring Captures)
    $pdo->exec("CREATE TABLE IF NOT EXISTS `proctor_snapshots` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `attempt_id` INT NOT NULL,
      `user_id` INT NOT NULL,
      `image_data` LONGTEXT NOT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // announcements
    $pdo->exec("CREATE TABLE IF NOT EXISTS `announcements` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `title` VARCHAR(255) NOT NULL,
      `content` TEXT NOT NULL,
      `target` ENUM('all','siswa','guru') NOT NULL DEFAULT 'all',
      `created_by` INT NOT NULL,
      `attachment_path` VARCHAR(255) DEFAULT NULL,
      `is_pinned` TINYINT(1) DEFAULT 0,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // grades
    $pdo->exec("CREATE TABLE IF NOT EXISTS `grades` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `student_id` INT NOT NULL,
      `course_id` INT NOT NULL,
      `semester` TINYINT NOT NULL DEFAULT 1,
      `nilai_tugas` FLOAT DEFAULT NULL,
      `nilai_uts` FLOAT DEFAULT NULL,
      `nilai_uas` FLOAT DEFAULT NULL,
      `nilai_hadir` FLOAT DEFAULT NULL,
      `nilai_akhir` FLOAT DEFAULT NULL,
      `predikat` CHAR(1) DEFAULT NULL,
      `created_by` INT DEFAULT NULL,
      `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY `unique_student_course_sem` (`student_id`,`course_id`,`semester`),
      FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // course_materials
    $pdo->exec("CREATE TABLE IF NOT EXISTS `course_materials` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `course_id` INT NOT NULL,
      `title` VARCHAR(255) NOT NULL,
      `type` ENUM('pdf','video','link','text') NOT NULL DEFAULT 'text',
      `content_url` VARCHAR(500) DEFAULT NULL,
      `content` TEXT DEFAULT NULL,
      `order_num` INT DEFAULT 0,
      `created_by` INT DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // assignments
    $pdo->exec("CREATE TABLE IF NOT EXISTS `assignments` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `course_id` INT NOT NULL,
      `title` VARCHAR(255) NOT NULL,
      `description` TEXT DEFAULT NULL,
      `due_date` DATETIME DEFAULT NULL,
      `max_score` INT NOT NULL DEFAULT 100,
      `created_by` INT DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // assignment_submissions
    $pdo->exec("CREATE TABLE IF NOT EXISTS `assignment_submissions` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `assignment_id` INT NOT NULL,
      `student_id` INT NOT NULL,
      `file_path` VARCHAR(500) DEFAULT NULL,
      `notes` TEXT DEFAULT NULL,
      `score` FLOAT DEFAULT NULL,
      `feedback` TEXT DEFAULT NULL,
      `submitted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      `graded_at` TIMESTAMP NULL,
      UNIQUE KEY `unique_sub` (`assignment_id`,`student_id`),
      FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // course_discussions
    $pdo->exec("CREATE TABLE IF NOT EXISTS `course_discussions` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `course_id` INT NOT NULL,
      `user_id` INT NOT NULL,
      `message` TEXT NOT NULL,
      `parent_id` INT DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // uploads dir
    $uploadDir = __DIR__ . '/uploads';
    if (!is_dir($uploadDir)) { @mkdir($uploadDir, 0755, true); }

    // Demo data — only on fresh install
    $existCheck = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($existCheck === 0) {
        $pdo->exec("INSERT IGNORE INTO `classes` (`class_name`,`major`,`academic_year`) VALUES
            ('X RPL 1','RPL','2026/2027'),('X RPL 2','RPL','2026/2027'),
            ('XI RPL 1','RPL','2026/2027'),('XII RPL 1','RPL','2026/2027'),
            ('X SIJA 1','SIJA','2026/2027'),('XI SIJA 1','SIJA','2026/2027'),
            ('X TKJ 1','TKJ','2026/2027'),('XI TKJ 1','TKJ','2026/2027');");

        $hash = password_hash('password123', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT IGNORE INTO `users` (`username`,`password`,`name`,`nip_nis`,`role`,`class_id`,`major`) VALUES (?,?,?,?,?,?,?)");
        $demoUsers = [
            ['admin','Administrator SMKN 1 Cibinong','198501012010011001','admin',null,'Umum'],
            ['guru1','Bpk. Andi Kurniawan, S.Kom','198703152012011002','guru',null,'RPL'],
            ['guru2','Ibu Dewi Rahmawati, S.Pd','199002222014012003','guru',null,'Umum'],
            ['guru3','Bpk. Fajar Sidik, S.T','199101012015011004','guru',null,'SIJA'],
            ['siswa1','Ahmad Fadhillah','0089712345','siswa',1,'RPL'],
            ['siswa2','Bunga Pratiwi','0089712346','siswa',1,'RPL'],
            ['siswa3','Candra Wijaya','0089712347','siswa',1,'RPL'],
            ['siswa4','Dina Marlina','0089712348','siswa',1,'RPL'],
            ['siswa5','Eko Santoso','0089712349','siswa',1,'RPL'],
            ['siswa6','Fira Nurul H.','0089712350','siswa',5,'SIJA'],
            ['siswa7','Galang Pratama','0089712351','siswa',5,'SIJA'],
        ];
        foreach ($demoUsers as $u) { $stmt->execute([$u[0],$hash,$u[1],$u[2],$u[3],$u[4],$u[5]]); }

        $pdo->exec("INSERT IGNORE INTO `courses` (`course_code`,`course_name`,`description`,`class_id`,`teacher_id`,`major`,`icon`) VALUES
            ('RPL-DPK','Dasar Pemrograman Komputer','Konsep dasar pemrograman algoritma dan logika.',1,2,'RPL','💻'),
            ('RPL-PWB','Pemrograman Web & Basis Data','HTML, CSS, JS, PHP, dan MySQL untuk web modern.',1,2,'RPL','🌐'),
            ('SIJA-JDK','Jaringan Komputer & SIJA','Dasar jaringan, TCP/IP, routing, dan VLAN.',5,4,'SIJA','🔌'),
            ('MTK','Matematika','Matematika wajib untuk semua jurusan.',NULL,3,'Umum','📐'),
            ('BIN','Bahasa Indonesia','Bahasa Indonesia untuk kompetensi komunikasi.',NULL,3,'Umum','📖'),
            ('PKK','Produk Kreatif & Kewirausahaan','Kewirausahaan dan produk kreatif vokasi.',NULL,2,'RPL','💼');");

        $pdo->exec("INSERT IGNORE INTO `schedules` (`course_id`,`class_id`,`day_of_week`,`start_time`,`end_time`,`room`,`created_by`) VALUES
            (1,1,'Senin','07:30:00','09:00:00','Lab Komputer 1',1),
            (2,1,'Selasa','07:30:00','10:00:00','Lab Komputer 2',1),
            (3,5,'Rabu','09:00:00','11:00:00','Lab Jaringan',1),
            (4,1,'Kamis','07:30:00','09:00:00','Ruang 10A',1),
            (5,1,'Jumat','08:00:00','09:30:00','Ruang 10A',1);");

        $pdo->exec("INSERT IGNORE INTO `quizzes` (`title`,`description`,`course_id`,`duration_minutes`,`kkm`,`shuffle_questions`,`created_by`,`status`) VALUES
            ('UTS Pemrograman Web Ganjil 2026','PTS Mapel Pemrograman Web & Basis Data.',2,45,75,1,2,'active'),
            ('Ulangan Harian Jaringan Komputer','UH bab pengkabelan dan topologi.',3,25,70,0,4,'active');");

        $pdo->exec("INSERT IGNORE INTO `questions` (`quiz_id`,`type`,`question_text`,`option_a`,`option_b`,`option_c`,`option_d`,`correct_option`,`points`) VALUES
            (1,'multiple_choice','Tag HTML untuk hyperlink?','<a>','<link>','<href>','<url>','A',1),
            (1,'multiple_choice','CSS singkatan dari?','Cascading Style Sheets','Computer Style Sheets','Colorful Style System','Creative Styling Script','A',1),
            (1,'multiple_choice','Properti CSS untuk warna teks?','font-color','text-color','color','text-style','C',1),
            (1,'multiple_choice','Fungsi PHP untuk output ke browser?','echo','print_r','console.log','alert','A',1),
            (1,'essay','Jelaskan perbedaan GET dan POST pada form HTML!',NULL,NULL,NULL,NULL,NULL,5);");

        $pdo->exec("INSERT IGNORE INTO `course_materials` (`course_id`,`title`,`type`,`content`,`order_num`,`created_by`) VALUES
            (2,'Pengenalan HTML & Struktur Dasar','text','HTML (HyperText Markup Language) adalah bahasa markup standar untuk membuat halaman web.',1,2),
            (2,'Modul PHP Dasar','text','Modul ini membahas dasar-dasar PHP mulai dari variabel, tipe data, kondisi, dan perulangan.',2,2),
            (1,'Algoritma & Flowchart','text','Algoritma adalah langkah-langkah terstruktur untuk menyelesaikan masalah.',1,2);");

        $pdo->exec("INSERT IGNORE INTO `course_materials` (`course_id`,`title`,`type`,`content_url`,`order_num`,`created_by`) VALUES
            (2,'Tutorial CSS Flexbox','link','https://css-tricks.com/snippets/css/a-guide-to-flexbox/',3,2);");

        $pdo->exec("INSERT IGNORE INTO `assignments` (`course_id`,`title`,`description`,`due_date`,`max_score`,`created_by`) VALUES
            (2,'Tugas 1: Buat Halaman Web Profil','Buat halaman web profil diri menggunakan HTML & CSS. Wajib responsive!',DATE_ADD(NOW(), INTERVAL 7 DAY),100,2),
            (2,'Tugas 2: Form Login PHP','Buat form login sederhana dengan validasi PHP dan MySQL.',DATE_ADD(NOW(), INTERVAL 14 DAY),100,2),
            (1,'Tugas Flowchart Algoritma','Gambar flowchart untuk algoritma menentukan bilangan prima.',DATE_ADD(NOW(), INTERVAL 5 DAY),100,2);");

        $pdo->exec("INSERT IGNORE INTO `announcements` (`title`,`content`,`target`,`created_by`,`is_pinned`) VALUES
            ('Pelaksanaan PTS Ganjil 2026/2027','Ujian Tengah Semester Ganjil dilaksanakan 21-28 September 2026 via CBT Online. Bagi yang mengalami kendala teknis, lapor ke pengawas untuk reset ujian.','all',1,1),
            ('Pengumpulan Tugas Pemrograman Web','Batas pengumpulan Tugas 1 Pemrograman Web: Jumat 27 September 2026 pukul 23:59.','siswa',2,0),
            ('Rapat Koordinasi Guru','Rapat koordinasi wali kelas dan guru mapel: Sabtu 22 September 2026 pukul 09.00 Ruang Rapat Utama.','guru',1,0);");

        // Demo attendance (last 30 working days for X RPL 1)
        $sids     = $pdo->query("SELECT id FROM users WHERE role='siswa' AND class_id=1")->fetchAll(PDO::FETCH_COLUMN);
        $classRow = $pdo->query("SELECT id FROM classes WHERE class_name='X RPL 1'")->fetchColumn();
        $stPool   = ['hadir','hadir','hadir','hadir','hadir','izin','sakit','alpa'];
        for ($d = 29; $d >= 0; $d--) {
            $dt = date('Y-m-d', strtotime("-$d days"));
            if (date('N', strtotime($dt)) >= 6) continue;
            foreach ($sids as $sid) {
                $st   = $stPool[array_rand($stPool)];
                $late = ($st === 'hadir' && rand(0,5) === 0) ? 1 : 0;
                try { $pdo->prepare("INSERT IGNORE INTO `attendance` (`course_id`,`class_id`,`student_id`,`date`,`status`,`is_late`,`created_by`) VALUES (1,?,?,?,?,?,1)")->execute([$classRow,$sid,$dt,$st,$late]); } catch (PDOException $e) {}
            }
        }

        // Demo grades for RPL students
        $gradeStds = $pdo->query("SELECT id FROM users WHERE role='siswa' AND class_id=1")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($gradeStds as $sid) {
            foreach ([1,2] as $cid) {
                $nt=$r=rand(70,95);$nuts=rand(65,90);$nuas=rand(68,92);$nh=rand(75,100);
                $na=round(($nt*0.3)+($nuts*0.2)+($nuas*0.3)+($nh*0.2),1);
                $pr=$na>=90?'A':($na>=80?'B':($na>=70?'C':'D'));
                try { $pdo->prepare("INSERT IGNORE INTO `grades` VALUES (NULL,?,?,1,?,?,?,?,?,?,1,NOW())")->execute([$sid,$cid,$nt,$nuts,$nuas,$nh,$na,$pr]); } catch (PDOException $e) {}
            }
        }
    }

    // Always ensure admin role
    try { $pdo->exec("UPDATE `users` SET `role`='admin' WHERE `username`='admin';"); } catch (PDOException $e) {}

} catch (PDOException $e) {
    if (!isset($pdo)) {
        header('Content-Type: application/json');
        echo json_encode(['success'=>false,'message'=>'DB Error: '.$e->getMessage()]);
        exit;
    }
}

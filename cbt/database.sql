-- SQL Schema for E-Learning SMKN 1 CIBINONG (cbt_exam)

CREATE DATABASE IF NOT EXISTS `cbt_exam` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cbt_exam`;

-- Table: classes
CREATE TABLE IF NOT EXISTS `classes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `class_name` VARCHAR(50) NOT NULL UNIQUE,
  `academic_year` VARCHAR(20) NOT NULL DEFAULT '2026/2027',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: users
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `nip_nis` VARCHAR(30) DEFAULT NULL,
  `role` ENUM('admin', 'guru', 'siswa') NOT NULL DEFAULT 'siswa',
  `class_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: courses
CREATE TABLE IF NOT EXISTS `courses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_code` VARCHAR(20) NOT NULL UNIQUE,
  `course_name` VARCHAR(100) NOT NULL,
  `class_id` INT DEFAULT NULL,
  `teacher_id` INT DEFAULT NULL,
  `icon` VARCHAR(50) DEFAULT '📚',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: attendance
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT DEFAULT NULL,
  `class_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('hadir', 'izin', 'sakit', 'alpa') NOT NULL DEFAULT 'hadir',
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_student_date_course` (`student_id`, `date`, `course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: quizzes
CREATE TABLE IF NOT EXISTS `quizzes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `course_id` INT DEFAULT NULL,
  `duration_minutes` INT NOT NULL DEFAULT 30,
  `created_by` INT NOT NULL,
  `status` ENUM('active', 'draft') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: questions
CREATE TABLE IF NOT EXISTS `questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` INT NOT NULL,
  `question_text` TEXT NOT NULL,
  `option_a` VARCHAR(255) NOT NULL,
  `option_b` VARCHAR(255) NOT NULL,
  `option_c` VARCHAR(255) NOT NULL,
  `option_d` VARCHAR(255) NOT NULL,
  `correct_option` CHAR(1) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: exam_attempts
CREATE TABLE IF NOT EXISTS `exam_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `score` FLOAT DEFAULT 0,
  `total_questions` INT DEFAULT 0,
  `correct_answers` INT DEFAULT 0,
  `violations_count` INT DEFAULT 0,
  `status` ENUM('in_progress', 'completed', 'disqualified') DEFAULT 'in_progress',
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `finished_at` TIMESTAMP NULL,
  FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: exam_answers
CREATE TABLE IF NOT EXISTS `exam_answers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `attempt_id` INT NOT NULL,
  `question_id` INT NOT NULL,
  `selected_option` CHAR(1) DEFAULT NULL,
  `is_correct` TINYINT(1) DEFAULT 0,
  FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: cheat_logs
CREATE TABLE IF NOT EXISTS `cheat_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `attempt_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `violation_type` VARCHAR(100) NOT NULL,
  `details` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE DATABASE IF NOT EXISTS jobs_portal;
USE jobs_portal;

-- Employer Table
CREATE TABLE employers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Candidate Table
CREATE TABLE candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    resume_path VARCHAR(500)

);

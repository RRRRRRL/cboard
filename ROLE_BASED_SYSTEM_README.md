# 🎓 Cboard Role-Based Access Control System

A comprehensive multi-role AAC (Augmentative and Alternative Communication) platform designed for special education centers, therapists, teachers, parents, and students.

## 📋 Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [User Roles](#user-roles)
- [Installation & Setup](#installation--setup)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Frontend Components](#frontend-components)
- [Sample Data](#sample-data)
- [Security & Permissions](#security--permissions)
- [Troubleshooting](#troubleshooting)

## ✨ Features

### 🏫 Multi-Organization Support
- **Organizations**: Schools, therapy centers, or AAC service providers
- **Classes**: Group students by classroom, grade, or therapy group
- **Subscription Management**: Free, Basic, Premium, and Enterprise tiers

### 👥 Role-Based Access Control
- **System Administrators**: Full platform management
- **Organization Admins**: Manage their organization
- **Teachers/Therapists**: Student progress tracking and AAC instruction
- **Parents/Guardians**: Monitor child progress and communicate with teachers
- **Students**: Personalized AAC communication interfaces

### 📊 Comprehensive Dashboards
- **Admin Dashboard**: Organization management, user administration, analytics
- **Teacher Dashboard**: Student progress, learning objectives, communication tracking
- **Parent Dashboard**: Child progress monitoring, teacher communication
- **Student Interface**: AAC communication with progress tracking

### 🎯 Learning Management
- **Individualized Learning Objectives**: Communication, academic, social, motor, cognitive goals
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Jyutping Games**: Interactive Cantonese pronunciation learning
- **AAC Skill Development**: Communication board usage analytics

### 💬 Communication & Collaboration
- **Teacher-Parent Communication**: Secure messaging system
- **Progress Notifications**: Automated updates on student achievements
- **Data Sharing Controls**: Granular permission management

## 🏗️ System Architecture

### Database Schema

#### Core Tables
- `users` - User accounts with roles
- `organizations` - Schools/therapy centers
- `classes` - Student groupings
- `user_organization_roles` - User-organization relationships

#### Educational Tables
- `student_teacher_assignments` - Teacher-student relationships
- `parent_child_relationships` - Parent-child connections
- `learning_objectives` - Individualized education goals
- `notifications` - Communication system

#### Data Management
- `data_sharing_permissions` - Permission controls
- `action_logs` - Audit trail (enhanced with organization context)

### Frontend Architecture

#### Components Structure
```
src/components/
├── Admin/                    # Admin-specific components
│   └── AdminDashboard/
├── Teacher/                  # Teacher components
│   └── TeacherDashboard/
├── Parent/                   # Parent components
│   └── ParentDashboard/
├── Account/SignUp/          # Role selection in signup
└── Navigation/              # Role-based navigation
    └── RoleBasedNavbar/
```

#### Routing
- `/admin/dashboard` - Admin control panel
- `/teacher/dashboard` - Teacher workspace
- `/parent/dashboard` - Parent monitoring
- `/` - Student AAC interface (default)

## 👥 User Roles

### 1. System Administrator (`admin`)
**Capabilities:**
- Platform-wide user management
- Organization creation and management
- System analytics and reporting
- Subscription management
- Data export and compliance

**Access:** All system features

### 2. Teacher/Educator (`teacher`)
**Capabilities:**
- Student progress tracking
- Learning objective creation and management
- Parent communication
- Class management
- AAC usage analytics

**Access:** Assigned students' data, their classes

### 3. Parent/Guardian (`parent`)
**Capabilities:**
- Child progress monitoring
- Teacher communication
- Emergency contact management
- Learning objective viewing
- AAC usage reports

**Access:** Their children's data only

### 4. Student (`student`)
**Capabilities:**
- AAC communication interface
- Educational games and activities
- Progress tracking (view only)
- Personalized communication boards

**Access:** Their own data and assigned content

## 🚀 Installation & Setup

### Prerequisites
- PHP 7.4+ with PDO MySQL extension
- MySQL 5.7+ or MariaDB 10.3+
- Node.js 14+ and npm/yarn
- Web server (Apache/Nginx) with PHP support

### Quick Setup (Windows)

1. **Clone and Install Dependencies**
   ```bash
   git clone https://github.com/your-repo/cboard.git
   cd cboard
   npm install
   ```

2. **Database Setup**
   ```bash
   cd backend
   setup-role-based-system.bat
   ```

3. **Alternative Manual Setup**
   ```bash
   # If PHP is in your PATH
   cd backend
   php scripts/setup-role-based-system.php

   # Or specify PHP path
   "C:\path\to\php\php.exe" scripts/setup-role-based-system.php
   ```

4. **Web Server Setup**
   - Copy `backend/` to your web server root
   - Configure database connection in `backend/config/database.php`
   - Set up virtual host or access via web server

### Sample Login Credentials

After setup, use these accounts to test the system:

| Role | Email | Password | Dashboard URL |
|------|-------|----------|---------------|
| Admin | admin@cboard.org | admin123 | /admin/dashboard |
| Teacher | teacher@cboard.org | teacher123 | /teacher/dashboard |
| Parent | parent@cboard.org | parent123 | /parent/dashboard |
| Student | student@cboard.org | student123 | / (default) |

## 📊 Database Schema

### Core Entities

#### Organizations
```sql
CREATE TABLE organizations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    description TEXT,
    contact_email VARCHAR(191),
    contact_phone VARCHAR(50),
    address TEXT,
    is_active TINYINT(1) DEFAULT 1,
    max_users INT DEFAULT 100,
    subscription_type ENUM('free','basic','premium','enterprise') DEFAULT 'free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### User Organization Roles
```sql
CREATE TABLE user_organization_roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    organization_id INT UNSIGNED NOT NULL,
    role ENUM('system_admin','org_admin','teacher','therapist','student','parent') NOT NULL,
    class_id INT UNSIGNED NULL,
    is_primary TINYINT(1) DEFAULT 0,
    permissions JSON NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT UNSIGNED NULL,
    is_active TINYINT(1) DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_org_role (user_id, organization_id, role)
);
```

#### Learning Objectives
```sql
CREATE TABLE learning_objectives (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_user_id INT UNSIGNED NOT NULL,
    teacher_user_id INT UNSIGNED NOT NULL,
    objective_type ENUM('communication','academic','social','motor','cognitive') NOT NULL,
    title VARCHAR(191) NOT NULL,
    description TEXT,
    target_date DATE,
    status ENUM('active','completed','cancelled','on_hold') DEFAULT 'active',
    progress_percentage INT DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## 🔗 API Documentation

### Authentication
All API endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Admin Endpoints

#### GET /admin/users
**Permission:** Admin only
**Description:** List all users with roles and organization assignments
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "teacher@cboard.org",
      "name": "Ms. Chan",
      "role": "teacher",
      "organizations": [...],
      "classes": [...]
    }
  ]
}
```

#### POST /admin/assign-role
**Permission:** Admin only
**Description:** Assign user to organization with specific role
```json
{
  "user_id": 1,
  "organization_id": 1,
  "role": "teacher",
  "class_id": 2
}
```

### Teacher Endpoints

#### GET /teacher/students
**Permission:** Teacher only
**Description:** List assigned students
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alex Chen",
      "progress": 75,
      "objectives": [...],
      "last_activity": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### POST /teacher/objective
**Permission:** Teacher only
**Description:** Create learning objective for student
```json
{
  "student_user_id": 1,
  "objective_type": "communication",
  "title": "Use AAC board to request items",
  "description": "Student will independently use AAC board to request preferred items during snack time",
  "target_date": "2024-02-15"
}
```

### Parent Endpoints

#### GET /parent/children
**Permission:** Parent only
**Description:** List parent's children
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alex Chen",
      "relationship": "child",
      "progress": 75,
      "teachers": [...],
      "recent_achievements": [...]
    }
  ]
}
```

## 🎨 Frontend Components

### Admin Dashboard
**Location:** `src/components/Admin/AdminDashboard/`
- Organization management interface
- User role assignment tools
- System analytics and reporting
- Subscription management

### Teacher Dashboard
**Location:** `src/components/Teacher/TeacherDashboard/`
- Student progress overview
- Learning objective management
- Parent communication tools
- Class management interface

### Parent Dashboard
**Location:** `src/components/Parent/ParentDashboard/`
- Child progress monitoring
- Teacher communication interface
- Achievement notifications
- Emergency contact management

### Role-Based Navigation
**Location:** `src/components/Navigation/RoleBasedNavbar/`
- Dynamic navigation based on user role
- Role-specific menu items
- Quick access to key functions

## 🔐 Security & Permissions

### Data Access Controls
- **Row-level security** on all database queries
- **Organization-scoped** data access
- **Role-based permissions** enforced at API level
- **Audit logging** for all data access

### Permission Matrix

| Feature | Admin | Teacher | Parent | Student |
|---------|-------|---------|--------|---------|
| View all users | ✅ | ❌ | ❌ | ❌ |
| Manage organizations | ✅ | ❌ | ❌ | ❌ |
| View assigned students | ✅ | ✅ | ❌ | ❌ |
| Create learning objectives | ✅ | ✅ | ❌ | ❌ |
| View child progress | ✅ | ✅ | ✅ | ❌ |
| Use AAC interface | ✅ | ✅ | ✅ | ✅ |
| Send messages | ✅ | ✅ | ✅ | ❌ |

### Data Privacy
- **GDPR compliant** data handling
- **Parental consent** tracking
- **Data retention** policies
- **Export capabilities** for data portability

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Errors
```
ERROR: Database connection failed
```
**Solution:**
- Verify database credentials in `backend/config/database.php`
- Ensure MySQL server is running
- Check database user permissions

#### Role Assignment Issues
```
ERROR: User not authorized for this action
```
**Solution:**
- Verify user has correct role in `user_organization_roles` table
- Check organization membership is active
- Confirm role permissions allow the requested action

#### Frontend Routing Issues
```
Component not found for route /admin/dashboard
```
**Solution:**
- Verify component imports in `src/App.js`
- Check that index files exist for components
- Ensure components are properly exported

### Debug Mode
Enable debug logging by setting environment variable:
```bash
DEBUG_ROLE_SYSTEM=1
```

### Database Reset
To reset the role system (⚠️ **DANGER: This deletes all data**):
```bash
# Backup first!
mysqldump -u username -p cboard_db > backup.sql

# Reset (run setup script again)
cd backend
php scripts/setup-role-based-system.php
```

## 📞 Support

For technical support or questions about the role-based system:

1. **Check this documentation** first
2. **Review the troubleshooting section**
3. **Check the GitHub issues** for known problems
4. **Create a new issue** with detailed information

### System Requirements
- **PHP:** 7.4+ with PDO MySQL extension
- **Database:** MySQL 5.7+ or MariaDB 10.3+
- **Web Server:** Apache 2.4+ or Nginx 1.18+
- **Browser:** Modern browsers with ES6+ support

---

## 🎯 Implementation Summary

This role-based access control system transforms Cboard from a simple AAC app into a comprehensive educational platform supporting:

- **Multi-organization management**
- **Role-specific user experiences**
- **Comprehensive progress tracking**
- **Secure communication channels**
- **Educational goal management**
- **Data privacy and compliance**

The system is designed to scale from small therapy practices to large school districts while maintaining security, usability, and compliance with educational data privacy regulations.

**Ready to revolutionize AAC education! 🚀📚**

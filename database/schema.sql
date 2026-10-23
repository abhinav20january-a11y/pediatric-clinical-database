-- Creates the complete pediatric clinic database.
-- Run this file once on a fresh MySQL database.

-- ============================================================
-- ACCESS CONTROL AND CLINICAL STAFF
-- ============================================================
CREATE DATABASE IF NOT EXISTS pediatric_clinic
CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE pediatric_clinic;

-- Stores roles such as administrator, doctor, nurse, and receptionist.
CREATE TABLE roles (
  role_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
);

-- Stores actions that a role is allowed to perform.
CREATE TABLE permissions (
  permission_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(80) NOT NULL UNIQUE, -- Technical permission name.
  description VARCHAR(255)
);

-- Connects roles with their permissions.
CREATE TABLE role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);

-- Stores login and basic information for staff members.
CREATE TABLE users (
  user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- Stores hospital departments.
CREATE TABLE departments (
  department_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(120),
  phone VARCHAR(30)
);

-- Stores doctor details and connects each doctor to a department.
CREATE TABLE doctors (
  doctor_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED UNIQUE,
  department_id BIGINT UNSIGNED NOT NULL,
  registration_number VARCHAR(60) NOT NULL UNIQUE,
  specialization VARCHAR(100) NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (consultation_fee >= 0),
  CONSTRAINT fk_doctor_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_doctor_department FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- ============================================================
-- PATIENT IDENTITY, GUARDIANS, AND REGISTRATION
-- ============================================================
-- Stores the patient's main personal, contact, and consent information.
CREATE TABLE patients (
  patient_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medical_record_number VARCHAR(30) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  date_of_birth DATE NOT NULL,
  sex_at_birth ENUM('female','male','intersex','unknown') NOT NULL,
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown') NOT NULL DEFAULT 'unknown',
  phone VARCHAR(30),
  address_line VARCHAR(255),
  city VARCHAR(80),
  postal_code VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  preferred_name VARCHAR(80) NULL,
  middle_name VARCHAR(80) NULL,
  email VARCHAR(150) NULL,
  alternate_phone VARCHAR(30) NULL,
  address_line_2 VARCHAR(255) NULL,
  state_province VARCHAR(80) NULL,
  country VARCHAR(80) NOT NULL DEFAULT 'India',
  nationality VARCHAR(80) NULL,
  preferred_language VARCHAR(60) NOT NULL DEFAULT 'English',
  communication_preference ENUM('phone','sms','email','portal','guardian') NOT NULL DEFAULT 'guardian',
  registration_source ENUM('walk_in','referral','emergency','transfer','online') NOT NULL DEFAULT 'walk_in',
  consent_to_treatment BOOLEAN NOT NULL DEFAULT FALSE,
  consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE,
  consent_recorded_at DATETIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_patient_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  -- Speeds active-patient, phone, and name searches.
  INDEX idx_patient_active_deleted (is_active, deleted_at),
  INDEX idx_patient_phone (phone),
  INDEX idx_patient_name_dob (last_name, first_name, date_of_birth)
);

-- Stores parent or guardian contact information.
CREATE TABLE guardians (
  guardian_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(150),
  address_line VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  alternate_phone VARCHAR(30) NULL,
  occupation VARCHAR(100) NULL,
  preferred_language VARCHAR(60) NULL,
  can_receive_updates BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Connects patients with their guardians.
CREATE TABLE patient_guardians (
  patient_id BIGINT UNSIGNED NOT NULL,
  guardian_id BIGINT UNSIGNED NOT NULL,
  relationship VARCHAR(40) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  has_legal_custody BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (patient_id, guardian_id),
  CONSTRAINT fk_pg_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE RESTRICT,
  CONSTRAINT fk_pg_guardian FOREIGN KEY (guardian_id) REFERENCES guardians(guardian_id) ON DELETE RESTRICT
);

-- ============================================================
-- APPOINTMENTS, VISITS, AND CLINICAL OBSERVATIONS
-- ============================================================
-- Stores planned appointments between patients and doctors.
CREATE TABLE appointments (
  appointment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status ENUM('scheduled','confirmed','checked_in','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  reason VARCHAR(255),
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
  CONSTRAINT fk_appt_creator FOREIGN KEY (created_by) REFERENCES users(user_id),
  -- Speeds doctor and patient appointment schedules.
  INDEX idx_appt_doctor_time (doctor_id, scheduled_at, status),
  INDEX idx_appt_patient_time (patient_id, scheduled_at)
);

-- Stores consultations that actually happened.
CREATE TABLE visits (
  visit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT UNSIGNED UNIQUE,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  visit_started_at DATETIME NOT NULL,
  visit_ended_at DATETIME,
  chief_complaint VARCHAR(500),
  disposition ENUM('home','admitted','referred','observation','left_without_care') DEFAULT 'home',
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_visit_appt FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
  CONSTRAINT fk_visit_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  CONSTRAINT fk_visit_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
  CONSTRAINT fk_visit_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  CHECK (visit_ended_at IS NULL OR visit_ended_at >= visit_started_at),
  -- Speeds patient and doctor visit histories.
  INDEX idx_visit_patient_date (patient_id, visit_started_at DESC),
  INDEX idx_visit_doctor_date (doctor_id, visit_started_at DESC)
);

-- Stores history, examination, and notes for one visit.
CREATE TABLE medical_records (
  medical_record_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id BIGINT UNSIGNED NOT NULL UNIQUE,
  history TEXT,
  examination TEXT,
  clinical_notes TEXT,
  recorded_by BIGINT UNSIGNED NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_record_visit FOREIGN KEY (visit_id) REFERENCES visits(visit_id) ON DELETE RESTRICT,
  CONSTRAINT fk_record_user FOREIGN KEY (recorded_by) REFERENCES users(user_id),
  CONSTRAINT fk_record_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id)
);

-- Stores diagnoses recorded during a visit.
CREATE TABLE diagnoses (
  diagnosis_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medical_record_id BIGINT UNSIGNED NOT NULL,
  icd_code VARCHAR(20),
  diagnosis_name VARCHAR(180) NOT NULL,
  diagnosis_type ENUM('provisional','confirmed','differential','resolved') NOT NULL DEFAULT 'confirmed',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_diag_record FOREIGN KEY (medical_record_id) REFERENCES medical_records(medical_record_id) ON DELETE RESTRICT,
  CONSTRAINT fk_diag_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  -- Speeds diagnosis searches by name or ICD code.
  INDEX idx_diag_name (diagnosis_name),
  INDEX idx_diag_code (icd_code)
);

-- Stores treatment instructions recorded by the doctor.
CREATE TABLE treatments (
  treatment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medical_record_id BIGINT UNSIGNED NOT NULL,
  treatment_name VARCHAR(180) NOT NULL,
  instructions TEXT,
  started_on DATE,
  ended_on DATE,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_treatment_record FOREIGN KEY (medical_record_id) REFERENCES medical_records(medical_record_id) ON DELETE RESTRICT,
  CONSTRAINT fk_treatment_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);

-- Stores temperature, heart rate, blood pressure, and other vital signs.
CREATE TABLE vital_signs (
  vital_sign_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id BIGINT UNSIGNED NOT NULL,
  temperature_c DECIMAL(4,1),
  heart_rate_bpm SMALLINT UNSIGNED,
  respiratory_rate_bpm SMALLINT UNSIGNED,
  systolic_bp SMALLINT UNSIGNED,
  diastolic_bp SMALLINT UNSIGNED,
  oxygen_saturation DECIMAL(5,2),
  measured_at DATETIME NOT NULL,
  measured_by BIGINT UNSIGNED NOT NULL,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_vital_visit FOREIGN KEY (visit_id) REFERENCES visits(visit_id) ON DELETE RESTRICT,
  CONSTRAINT fk_vital_user FOREIGN KEY (measured_by) REFERENCES users(user_id),
  CONSTRAINT fk_vital_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  CHECK (temperature_c IS NULL OR temperature_c BETWEEN 25 AND 45),
  CHECK (oxygen_saturation IS NULL OR oxygen_saturation BETWEEN 0 AND 100),
  -- Speeds the vital-sign timeline for a visit.
  INDEX idx_vital_visit_time (visit_id, measured_at)
);

-- Stores height, weight, percentiles, and calculated BMI.
CREATE TABLE growth_records (
  growth_record_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id BIGINT UNSIGNED NOT NULL UNIQUE,
  patient_id BIGINT UNSIGNED NOT NULL,
  height_cm DECIMAL(5,2),
  weight_kg DECIMAL(6,2),
  head_circumference_cm DECIMAL(5,2),
  bmi DECIMAL(5,2) GENERATED ALWAYS AS (CASE WHEN height_cm > 0 THEN ROUND(weight_kg / POW(height_cm / 100, 2), 2) END) STORED,
  height_percentile DECIMAL(5,2),
  weight_percentile DECIMAL(5,2),
  measured_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_growth_visit FOREIGN KEY (visit_id) REFERENCES visits(visit_id) ON DELETE RESTRICT,
  CONSTRAINT fk_growth_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  CONSTRAINT fk_growth_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  CHECK (height_cm IS NULL OR height_cm > 0),
  CHECK (weight_kg IS NULL OR weight_kg > 0),
  -- Speeds a patient's growth timeline.
  INDEX idx_growth_patient_time (patient_id, measured_at)
);

-- ============================================================
-- LONGITUDINAL PATIENT SAFETY RECORDS
-- ============================================================
-- Stores patient allergies and reactions.
CREATE TABLE allergies (
  allergy_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  allergen VARCHAR(120) NOT NULL,
  reaction VARCHAR(255),
  severity ENUM('mild','moderate','severe','unknown') NOT NULL DEFAULT 'unknown',
  status ENUM('active','resolved','unconfirmed') NOT NULL DEFAULT 'active',
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_allergy_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE RESTRICT,
  CONSTRAINT fk_allergy_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  -- Prevents the same allergen being entered twice for one patient.
  UNIQUE KEY uq_patient_allergen (patient_id, allergen)
);

-- Stores the patient's vaccination history.
CREATE TABLE immunizations (
  immunization_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  vaccine_name VARCHAR(150) NOT NULL,
  dose_number TINYINT UNSIGNED,
  administered_on DATE NOT NULL,
  lot_number VARCHAR(80),
  administered_by BIGINT UNSIGNED,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_imm_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE RESTRICT,
  CONSTRAINT fk_imm_doctor FOREIGN KEY (administered_by) REFERENCES doctors(doctor_id),
  CONSTRAINT fk_imm_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  -- Speeds a patient's vaccination history.
  INDEX idx_imm_patient_date (patient_id, administered_on)
);

-- ============================================================
-- MEDICATION, LABORATORY, AND FOLLOW-UP WORKFLOWS
-- ============================================================
-- Stores the medicine catalogue.
CREATE TABLE medications (
  medication_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  generic_name VARCHAR(150) NOT NULL,
  brand_name VARCHAR(150),
  form VARCHAR(80) NOT NULL,
  strength VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Prevents duplicate medicine catalogue entries.
  UNIQUE KEY uq_medication (generic_name, form, strength)
);

-- Stores the main prescription record.
CREATE TABLE prescriptions (
  prescription_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  prescribed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(500),
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_rx_visit FOREIGN KEY (visit_id) REFERENCES visits(visit_id),
  CONSTRAINT fk_rx_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  CONSTRAINT fk_rx_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
  CONSTRAINT fk_rx_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  -- Speeds a patient's latest-prescription history.
  INDEX idx_rx_patient_date (patient_id, prescribed_at DESC)
);

-- Stores medicines and instructions inside a prescription.
CREATE TABLE prescription_items (
  prescription_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prescription_id BIGINT UNSIGNED NOT NULL,
  medication_id BIGINT UNSIGNED NOT NULL,
  dose VARCHAR(80) NOT NULL,
  frequency VARCHAR(80) NOT NULL,
  route VARCHAR(60) NOT NULL,
  duration_days SMALLINT UNSIGNED,
  instructions VARCHAR(500),
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_rxitem_rx FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rxitem_med FOREIGN KEY (medication_id) REFERENCES medications(medication_id),
  CONSTRAINT fk_rxitem_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id)
);

-- Stores the list of available laboratory tests.
CREATE TABLE lab_tests (
  lab_test_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  test_code VARCHAR(40) NOT NULL UNIQUE,
  test_name VARCHAR(150) NOT NULL,
  unit VARCHAR(40),
  reference_range VARCHAR(100)
);

-- Stores laboratory tests ordered during visits.
CREATE TABLE lab_orders (
  lab_order_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id BIGINT UNSIGNED NOT NULL,
  lab_test_id BIGINT UNSIGNED NOT NULL,
  ordered_by BIGINT UNSIGNED NOT NULL,
  status ENUM('ordered','collected','completed','cancelled') NOT NULL DEFAULT 'ordered',
  ordered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_laborder_visit FOREIGN KEY (visit_id) REFERENCES visits(visit_id),
  CONSTRAINT fk_laborder_test FOREIGN KEY (lab_test_id) REFERENCES lab_tests(lab_test_id),
  CONSTRAINT fk_laborder_doctor FOREIGN KEY (ordered_by) REFERENCES doctors(doctor_id),
  CONSTRAINT fk_laborder_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  -- Speeds lab-order filtering for a visit.
  INDEX idx_laborder_visit_status (visit_id, status)
);

-- Stores the result of a laboratory order.
CREATE TABLE lab_results (
  lab_result_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lab_order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  result_value VARCHAR(120) NOT NULL,
  is_abnormal BOOLEAN NOT NULL DEFAULT FALSE,
  notes VARCHAR(500),
  resulted_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_labresult_order FOREIGN KEY (lab_order_id) REFERENCES lab_orders(lab_order_id) ON DELETE RESTRICT,
  CONSTRAINT fk_labresult_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id)
);

-- Stores work that needs to happen after a visit.
CREATE TABLE follow_ups (
  follow_up_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id BIGINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('pending','scheduled','completed','cancelled','overdue') NOT NULL DEFAULT 'pending',
  appointment_id BIGINT UNSIGNED,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  category ENUM('clinical_review','lab_result','medication','immunization','growth_monitoring','referral','care_coordination','other') NOT NULL DEFAULT 'clinical_review',
  priority ENUM('routine','urgent','high_risk') NOT NULL DEFAULT 'routine',
  assigned_doctor_id BIGINT UNSIGNED NULL,
  assigned_user_id BIGINT UNSIGNED NULL,
  contact_channel ENUM('phone','sms','email','portal','in_person','none') NOT NULL DEFAULT 'phone',
  contact_status ENUM('not_started','attempted','reached','message_left','unreachable','declined') NOT NULL DEFAULT 'not_started',
  next_action VARCHAR(500) NULL,
  outcome TEXT NULL,
  completed_at DATETIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_followup_visit FOREIGN KEY (visit_id) REFERENCES visits(visit_id),
  CONSTRAINT fk_followup_appt FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
  CONSTRAINT fk_followup_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  -- Speeds overdue, assigned-user, and priority worklists.
  INDEX idx_followup_due (status, due_date),
  CONSTRAINT fk_followup_doctor FOREIGN KEY (assigned_doctor_id) REFERENCES doctors(doctor_id),
  CONSTRAINT fk_followup_user FOREIGN KEY (assigned_user_id) REFERENCES users(user_id),
  INDEX idx_followup_owner_queue (assigned_user_id, status, due_date),
  INDEX idx_followup_priority_due (priority, status, due_date)
);

-- ============================================================
-- AUDIT TRAIL AND VERSIONED QUESTIONNAIRE MODEL
-- ============================================================
-- Stores who changed a record and its before/after data.
CREATE TABLE audit_logs (
  audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED,
  before_data JSON,
  after_data JSON,
  occurred_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  ip_address VARCHAR(45),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id),
  -- Speeds audit history by record or user.
  INDEX idx_audit_entity (entity_type, entity_id, occurred_at DESC),
  INDEX idx_audit_actor_time (actor_user_id, occurred_at DESC)
);

-- Stores reusable questionnaire templates and their versions.
CREATE TABLE custom_forms (
  form_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  form_key VARCHAR(80) NOT NULL,
  form_name VARCHAR(150) NOT NULL,
  description VARCHAR(500),
  version INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('draft','active','retired') NOT NULL DEFAULT 'draft',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_custom_form_version UNIQUE (form_key, version),
  CONSTRAINT chk_custom_form_version CHECK (version >= 1),
  CONSTRAINT fk_custom_form_creator FOREIGN KEY (created_by) REFERENCES users(user_id),
  -- Speeds active/retired form lookup.
  INDEX idx_custom_forms_status (status, form_key)
);

-- Stores the fields belonging to a questionnaire template.
CREATE TABLE custom_form_fields (
  form_field_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  form_id BIGINT UNSIGNED NOT NULL,
  field_key VARCHAR(80) NOT NULL,
  label VARCHAR(150) NOT NULL,
  field_type ENUM('text','textarea','number','date','boolean','dropdown','checkbox') NOT NULL,
  help_text VARCHAR(500),
  options JSON,
  validation_rules JSON,
  section_name VARCHAR(150),
  section_order INT UNSIGNED NOT NULL DEFAULT 0,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  default_value JSON,
  CONSTRAINT uq_custom_form_field UNIQUE (form_id, field_key),
  CONSTRAINT fk_custom_form_field_form FOREIGN KEY (form_id) REFERENCES custom_forms(form_id) ON DELETE CASCADE,
  CONSTRAINT chk_field_options_required CHECK (field_type NOT IN ('dropdown','checkbox') OR options IS NOT NULL),
  CONSTRAINT chk_custom_field_options CHECK (options IS NULL OR JSON_TYPE(options) = 'ARRAY'),
  CONSTRAINT chk_custom_field_validation CHECK (validation_rules IS NULL OR JSON_TYPE(validation_rules) = 'OBJECT'),
  -- Loads form fields in display order.
  INDEX idx_custom_form_fields_order (form_id, section_order, display_order)
);

-- Stores one visit's answers as a JSON object.
CREATE TABLE custom_form_responses (
  response_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  form_id BIGINT UNSIGNED NOT NULL,
  visit_id BIGINT UNSIGNED NOT NULL,
  answers JSON NOT NULL,
  extra_fields JSON,
  recorded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT uq_custom_form_response UNIQUE (visit_id, form_id),
  CONSTRAINT fk_response_form FOREIGN KEY (form_id) REFERENCES custom_forms(form_id),
  CONSTRAINT fk_response_visit FOREIGN KEY (visit_id) REFERENCES visits(visit_id) ON DELETE RESTRICT,
  CONSTRAINT fk_response_recorder FOREIGN KEY (recorded_by) REFERENCES users(user_id),
  CONSTRAINT fk_response_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  CONSTRAINT chk_response_answers CHECK (JSON_TYPE(answers) = 'OBJECT'),
  CONSTRAINT chk_response_extra_fields CHECK (extra_fields IS NULL OR JSON_TYPE(extra_fields) = 'ARRAY'),
  CONSTRAINT chk_response_version CHECK (version >= 1),
  -- Speeds response lookup for a form.
  INDEX idx_response_form (form_id)
);

-- Stores older versions of questionnaire answers.
CREATE TABLE custom_form_response_history (
  history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  response_id BIGINT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  answers JSON NOT NULL,
  extra_fields JSON,
  changed_by BIGINT UNSIGNED NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_response_history_version UNIQUE (response_id, version),
  CONSTRAINT fk_response_history_response FOREIGN KEY (response_id) REFERENCES custom_form_responses(response_id) ON DELETE RESTRICT,
  CONSTRAINT fk_response_history_user FOREIGN KEY (changed_by) REFERENCES users(user_id),
  CONSTRAINT chk_history_answers CHECK (JSON_TYPE(answers) = 'OBJECT'),
  CONSTRAINT chk_history_extra_fields CHECK (extra_fields IS NULL OR JSON_TYPE(extra_fields) = 'ARRAY'),
  CONSTRAINT chk_history_version CHECK (version >= 1)
);

-- Defines extra fields that appear on patient, visit, and other clinical forms.
CREATE TABLE clinical_custom_fields (
  custom_field_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  context_type ENUM('patient','visit','prescription','lab_order','allergy','immunization','follow_up') NOT NULL,
  field_key VARCHAR(80) NOT NULL,
  label VARCHAR(150) NOT NULL,
  field_type ENUM('text','textarea','number','date','boolean','dropdown','checkbox') NOT NULL,
  help_text VARCHAR(500),
  options JSON,
  validation_rules JSON,
  section_name VARCHAR(150) NOT NULL DEFAULT 'Additional information',
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  active_field_key VARCHAR(80) GENERATED ALWAYS AS
    (CASE WHEN deleted_at IS NULL THEN field_key ELSE NULL END) STORED,
  CONSTRAINT uq_clinical_custom_field_active UNIQUE (context_type, active_field_key),
  CONSTRAINT fk_clinical_custom_field_creator FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_clinical_custom_field_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  CONSTRAINT chk_clinical_custom_options_required CHECK
    (field_type NOT IN ('dropdown','checkbox') OR options IS NOT NULL),
  CONSTRAINT chk_clinical_custom_options CHECK
    (options IS NULL OR JSON_TYPE(options) = 'ARRAY'),
  CONSTRAINT chk_clinical_custom_validation CHECK
    (validation_rules IS NULL OR JSON_TYPE(validation_rules) = 'OBJECT'),
  -- Loads active dynamic fields in screen order.
  INDEX idx_clinical_custom_field_order (context_type, deleted_at, section_name, display_order)
);

-- Stores the JSON value entered for a dynamic field.
CREATE TABLE clinical_custom_field_values (
  custom_value_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  custom_field_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NULL,
  visit_id BIGINT UNSIGNED NULL,
  prescription_id BIGINT UNSIGNED NULL,
  lab_order_id BIGINT UNSIGNED NULL,
  allergy_id BIGINT UNSIGNED NULL,
  immunization_id BIGINT UNSIGNED NULL,
  follow_up_id BIGINT UNSIGNED NULL,
  value_json JSON,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  recorded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_custom_value_field FOREIGN KEY (custom_field_id) REFERENCES clinical_custom_fields(custom_field_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_visit FOREIGN KEY (visit_id) REFERENCES visits(visit_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_lab FOREIGN KEY (lab_order_id) REFERENCES lab_orders(lab_order_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_allergy FOREIGN KEY (allergy_id) REFERENCES allergies(allergy_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_immunization FOREIGN KEY (immunization_id) REFERENCES immunizations(immunization_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_followup FOREIGN KEY (follow_up_id) REFERENCES follow_ups(follow_up_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_recorder FOREIGN KEY (recorded_by) REFERENCES users(user_id),
  CONSTRAINT fk_custom_value_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  CONSTRAINT chk_custom_value_one_owner CHECK (
    (patient_id IS NOT NULL) + (visit_id IS NOT NULL) + (prescription_id IS NOT NULL) +
    (lab_order_id IS NOT NULL) + (allergy_id IS NOT NULL) + (immunization_id IS NOT NULL) +
    (follow_up_id IS NOT NULL) = 1
  ),
  CONSTRAINT chk_custom_value_version CHECK (version >= 1),
  CONSTRAINT uq_custom_value_patient UNIQUE (custom_field_id, patient_id),
  CONSTRAINT uq_custom_value_visit UNIQUE (custom_field_id, visit_id),
  CONSTRAINT uq_custom_value_prescription UNIQUE (custom_field_id, prescription_id),
  CONSTRAINT uq_custom_value_lab UNIQUE (custom_field_id, lab_order_id),
  CONSTRAINT uq_custom_value_allergy UNIQUE (custom_field_id, allergy_id),
  CONSTRAINT uq_custom_value_immunization UNIQUE (custom_field_id, immunization_id),
  CONSTRAINT uq_custom_value_followup UNIQUE (custom_field_id, follow_up_id)
);

-- Stores previous versions of dynamic-field values.
CREATE TABLE clinical_custom_field_value_history (
  history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  custom_value_id BIGINT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  value_json JSON,
  changed_by BIGINT UNSIGNED NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_custom_value_history UNIQUE (custom_value_id, version),
  CONSTRAINT fk_custom_value_history_value FOREIGN KEY (custom_value_id) REFERENCES clinical_custom_field_values(custom_value_id) ON DELETE RESTRICT,
  CONSTRAINT fk_custom_value_history_user FOREIGN KEY (changed_by) REFERENCES users(user_id),
  CONSTRAINT chk_custom_value_history_version CHECK (version >= 1)
);

-- ============================================================
-- EXTENDED REGISTRATION AND FOLLOW-UP NOTES
-- ============================================================
-- Stores MRN, government ID, passport, and other patient identifiers.
CREATE TABLE patient_identifiers (
  patient_identifier_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  identifier_type ENUM('hospital_mrn','national_health_id','government_id','passport','birth_certificate','other') NOT NULL,
  identifier_value VARCHAR(120) NOT NULL,
  issuing_authority VARCHAR(120),
  valid_from DATE,
  valid_to DATE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_identifier_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE RESTRICT,
  CONSTRAINT fk_identifier_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  UNIQUE KEY uq_identifier_type_value (identifier_type, identifier_value),
  -- Speeds primary-identifier lookup for a patient.
  INDEX idx_identifier_patient (patient_id, is_primary)
);

-- Stores the patient's insurance policies.
CREATE TABLE insurance_coverages (
  coverage_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  provider_name VARCHAR(150) NOT NULL,
  plan_name VARCHAR(150),
  policy_number VARCHAR(100) NOT NULL,
  member_id VARCHAR(100),
  policy_holder_name VARCHAR(150),
  relationship_to_patient VARCHAR(50),
  valid_from DATE,
  valid_to DATE,
  status ENUM('active','inactive','pending','expired') NOT NULL DEFAULT 'active',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deletion_reason VARCHAR(500) NULL,
  CONSTRAINT fk_coverage_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE RESTRICT,
  CONSTRAINT fk_coverage_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id),
  UNIQUE KEY uq_coverage_policy (provider_name, policy_number),
  -- Speeds active insurance lookup for a patient.
  INDEX idx_coverage_patient_status (patient_id, status)
);

-- Stores notes and contact attempts for a follow-up.
CREATE TABLE follow_up_notes (
  follow_up_note_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  follow_up_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NOT NULL,
  note_type ENUM('clinical','contact_attempt','status_change','coordination','general') NOT NULL DEFAULT 'general',
  note_text TEXT NOT NULL,
  contact_channel ENUM('phone','sms','email','portal','in_person','none') NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_followupnote_followup FOREIGN KEY (follow_up_id) REFERENCES follow_ups(follow_up_id) ON DELETE RESTRICT,
  CONSTRAINT fk_followupnote_author FOREIGN KEY (author_user_id) REFERENCES users(user_id),
  -- Loads follow-up notes in timeline order.
  INDEX idx_followupnote_timeline (follow_up_id, created_at DESC)
);

-- Reporting views, audit rules and database routines.
-- Read model joining patient, visit, doctor, and diagnosis data for timelines.
CREATE VIEW v_patient_visit_summary AS
SELECT v.visit_id, v.patient_id, p.medical_record_number,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       v.visit_started_at, u.full_name AS doctor_name,
       v.chief_complaint, v.disposition,
       GROUP_CONCAT(DISTINCT d.diagnosis_name ORDER BY d.is_primary DESC SEPARATOR ', ') AS diagnoses
FROM visits v
JOIN patients p ON p.patient_id = v.patient_id -- Connects each visit to its patient.
JOIN doctors dr ON dr.doctor_id = v.doctor_id -- Connects the visit to its doctor profile.
JOIN users u ON u.user_id = dr.user_id -- Gets the doctor's name from users.
LEFT JOIN medical_records mr ON mr.visit_id = v.visit_id AND mr.deleted_at IS NULL
LEFT JOIN diagnoses d ON d.medical_record_id = mr.medical_record_id AND d.deleted_at IS NULL
WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL
GROUP BY v.visit_id, v.patient_id, p.medical_record_number, p.first_name, p.last_name,
         v.visit_started_at, u.full_name, v.chief_complaint, v.disposition;

-- Daily appointment counts and outcome totals for each doctor.
CREATE VIEW v_doctor_daily_workload AS
SELECT d.doctor_id, u.full_name AS doctor_name, DATE(a.scheduled_at) AS work_date,
       COUNT(*) AS total_appointments,
       SUM(a.status = 'completed') AS completed,
       SUM(a.status = 'no_show') AS no_shows
FROM doctors d
JOIN users u ON u.user_id = d.user_id
JOIN appointments a ON a.doctor_id = d.doctor_id
GROUP BY d.doctor_id, u.full_name, DATE(a.scheduled_at);

-- Active follow-up tasks whose due date has passed.
CREATE VIEW v_overdue_follow_ups AS
SELECT f.follow_up_id, f.due_date, f.reason, v.patient_id,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name, p.phone
FROM follow_ups f
JOIN visits v ON v.visit_id = f.visit_id
JOIN patients p ON p.patient_id = v.patient_id
WHERE f.deleted_at IS NULL AND v.deleted_at IS NULL AND p.deleted_at IS NULL
  AND f.status IN ('pending','overdue') AND f.due_date < CURRENT_DATE;

DELIMITER $$
-- Protect published/retired templates; only disposable drafts may be hard-deleted.
CREATE TRIGGER trg_custom_forms_before_delete
BEFORE DELETE ON custom_forms FOR EACH ROW
BEGIN
  IF OLD.status <> 'draft' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only draft form templates may be deleted';
  END IF;
END$$

-- Reusable database routine returning one patient's visits newest first.
CREATE PROCEDURE sp_patient_timeline(IN p_patient_id BIGINT UNSIGNED)
BEGIN
  SELECT * FROM v_patient_visit_summary
  WHERE patient_id = p_patient_id
  ORDER BY visit_started_at DESC;
END$$

-- Whenever a new form field is created, an audit log entry is automatically added.
CREATE TRIGGER trg_custom_form_fields_after_insert
AFTER INSERT ON custom_form_fields FOR EACH ROW
BEGIN
  INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, after_data)
  SELECT created_by, 'CREATE', 'custom_form_field', NEW.form_field_id,
         JSON_OBJECT('form_id', NEW.form_id, 'field_key', NEW.field_key,
                     'label', NEW.label, 'field_type', NEW.field_type)
  FROM custom_forms WHERE form_id = NEW.form_id;
END$$

-- Stores the form’s old and new name, status, and version.
CREATE TRIGGER trg_custom_forms_after_update
AFTER UPDATE ON custom_forms FOR EACH ROW
BEGIN
  INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (NEW.created_by, 'UPDATE', 'custom_form', NEW.form_id,
          JSON_OBJECT('name', OLD.form_name, 'status', OLD.status, 'version', OLD.version),
          JSON_OBJECT('name', NEW.form_name, 'status', NEW.status, 'version', NEW.version));
END$$

-- Record the questionnaire response version and answers before/after an update.
CREATE TRIGGER trg_custom_form_response_after_update
AFTER UPDATE ON custom_form_responses FOR EACH ROW
BEGIN
  INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (NEW.recorded_by, 'UPDATE', 'custom_form_response', NEW.response_id,
          JSON_OBJECT('version', OLD.version, 'answers', OLD.answers),
          JSON_OBJECT('version', NEW.version, 'answers', NEW.answers));
END$$

-- Reject a new value when its populated owner does not match the field context.
CREATE TRIGGER trg_clinical_custom_value_before_insert
BEFORE INSERT ON clinical_custom_field_values FOR EACH ROW
BEGIN
  DECLARE expected_context VARCHAR(30);
  SELECT context_type INTO expected_context FROM clinical_custom_fields
  WHERE custom_field_id=NEW.custom_field_id AND deleted_at IS NULL;
  IF expected_context IS NULL OR
     (expected_context='patient' AND NEW.patient_id IS NULL) OR
     (expected_context='visit' AND NEW.visit_id IS NULL) OR
     (expected_context='prescription' AND NEW.prescription_id IS NULL) OR
     (expected_context='lab_order' AND NEW.lab_order_id IS NULL) OR
     (expected_context='allergy' AND NEW.allergy_id IS NULL) OR
     (expected_context='immunization' AND NEW.immunization_id IS NULL) OR
     (expected_context='follow_up' AND NEW.follow_up_id IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Custom field context does not match its clinical record';
  END IF;
END$$

-- Apply the same context/owner integrity rule to value updates.
CREATE TRIGGER trg_clinical_custom_value_before_update
BEFORE UPDATE ON clinical_custom_field_values FOR EACH ROW
BEGIN
  DECLARE expected_context VARCHAR(30);
  SELECT context_type INTO expected_context FROM clinical_custom_fields
  WHERE custom_field_id=NEW.custom_field_id;
  IF expected_context IS NULL OR
     (expected_context='patient' AND NEW.patient_id IS NULL) OR
     (expected_context='visit' AND NEW.visit_id IS NULL) OR
     (expected_context='prescription' AND NEW.prescription_id IS NULL) OR
     (expected_context='lab_order' AND NEW.lab_order_id IS NULL) OR
     (expected_context='allergy' AND NEW.allergy_id IS NULL) OR
     (expected_context='immunization' AND NEW.immunization_id IS NULL) OR
     (expected_context='follow_up' AND NEW.follow_up_id IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Custom field context does not match its clinical record';
  END IF;
END$$
DELIMITER ;

-- Demonstration dataset for a fresh development database.
-- All names and clinical records are synthetic and must not be treated as PHI.
-- Run schema.sql first, then run this file once to add demonstration records.
-- START TRANSACTION and COMMIT make this seed an all-or-nothing operation:
-- if an insert fails before COMMIT, the incomplete batch can be rolled back.

USE pediatric_clinic;

START TRANSACTION;

-- STEP 1: Add reference data used by later records.
-- Subqueries find IDs by name, so the script does not guess auto-increment numbers.
INSERT INTO roles (role_name, description) VALUES
('administrator','System configuration and audit access'),
('doctor','Clinical care and prescribing'),
('nurse','Triage, observations and care support'),
('receptionist','Registration and scheduling');

INSERT INTO permissions (permission_key, description) VALUES
('patient.read','View patients'),('patient.write','Create and edit patients'),
('clinical.write','Record clinical care'),('prescription.write','Issue prescriptions'),
('forms.manage','Manage dynamic form definitions'),('audit.read','Review audit history');

INSERT INTO role_permissions
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p WHERE r.role_name='administrator';
INSERT INTO role_permissions
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
  ON p.permission_key IN ('patient.read','clinical.write','prescription.write') WHERE r.role_name='doctor';

-- Passwords are non-functional placeholders; authentication is outside this prototype.
INSERT INTO users (role_id,email,password_hash,full_name) VALUES
((SELECT role_id FROM roles WHERE role_name='administrator'),'admin@demo.local','DEMO_ONLY','Demo Administrator'),
((SELECT role_id FROM roles WHERE role_name='doctor'),'meera@demo.local','DEMO_ONLY','Dr Meera Rao'),
((SELECT role_id FROM roles WHERE role_name='doctor'),'arjun@demo.local','DEMO_ONLY','Dr Arjun Sen'),
((SELECT role_id FROM roles WHERE role_name='nurse'),'kavya@demo.local','DEMO_ONLY','Kavya Nair'),
((SELECT role_id FROM roles WHERE role_name='doctor'),'nisha@demo.local','DEMO_ONLY','Dr Nisha Verma'),
((SELECT role_id FROM roles WHERE role_name='doctor'),'kabir@demo.local','DEMO_ONLY','Dr Kabir Malhotra'),
((SELECT role_id FROM roles WHERE role_name='doctor'),'farah@demo.local','DEMO_ONLY','Dr Farah Ali'),
((SELECT role_id FROM roles WHERE role_name='doctor'),'rohan@demo.local','DEMO_ONLY','Dr Rohan Kulkarni'),
((SELECT role_id FROM roles WHERE role_name='doctor'),'tara@demo.local','DEMO_ONLY','Dr Tara Bedi');

INSERT INTO departments (department_name,location,phone) VALUES
('General Pediatrics','Block A - Level 2','011-555-0100'),
('Pediatric Pulmonology','Block B - Level 1','011-555-0110'),
('Neonatology','Block A - Level 3','011-555-0120'),
('Pediatric Gastroenterology','Block C - Level 1','011-555-0130'),
('Adolescent Medicine','Block C - Level 2','011-555-0140');

INSERT INTO doctors (user_id,department_id,registration_number,specialization,consultation_fee) VALUES
((SELECT user_id FROM users WHERE email='meera@demo.local'),1,'DMC-PED-1042','General Pediatrics',800),
((SELECT user_id FROM users WHERE email='arjun@demo.local'),2,'DMC-PED-1187','Pediatric Pulmonology',1000),
((SELECT user_id FROM users WHERE email='nisha@demo.local'),3,'DMC-PED-1214','Neonatology',1200),
((SELECT user_id FROM users WHERE email='kabir@demo.local'),4,'DMC-PED-1268','Pediatric Gastroenterology',1100),
((SELECT user_id FROM users WHERE email='farah@demo.local'),1,'DMC-PED-1305','General Pediatrics',850),
((SELECT user_id FROM users WHERE email='rohan@demo.local'),5,'DMC-PED-1349','Adolescent Medicine',950),
((SELECT user_id FROM users WHERE email='tara@demo.local'),2,'DMC-PED-1391','Pediatric Pulmonology',1050);

-- STEP 2: Add 30 synthetic pediatric patients and linked registration data.
INSERT INTO patients (medical_record_number,first_name,last_name,date_of_birth,sex_at_birth,blood_group,phone,address_line,city,postal_code) VALUES
('PED-2026-0001','Aarav','Sharma','2018-04-12','male','O+','9000000001','12 Green Lane','New Delhi','110001'),
('PED-2026-0002','Anaya','Iyer','2021-09-03','female','A+','9000000002','44 Lake View','New Delhi','110016'),
('PED-2026-0003','Vihaan','Khan','2015-01-21','male','B+','9000000003','8 Park Road','Noida','201301'),
('PED-2026-0004','Sara','Das','2023-05-18','female','AB+','9000000004','71 Rose Street','Gurugram','122001'),
('PED-2026-0005','Ishaan','Gupta','2017-02-14','male','A+','9000000005','15 Ashoka Road','New Delhi','110003'),
('PED-2026-0006','Myra','Kapoor','2020-11-29','female','O+','9000000006','22 Vasant Marg','New Delhi','110057'),
('PED-2026-0007','Advait','Joshi','2014-07-08','male','B+','9000000007','19 Sector 27','Noida','201301'),
('PED-2026-0008','Kiara','Menon','2019-03-17','female','A-','9000000008','6 Palm Enclave','Gurugram','122002'),
('PED-2026-0009','Reyansh','Singh','2022-12-02','male','O+','9000000009','41 Model Town','New Delhi','110009'),
('PED-2026-0010','Aadhya','Bose','2016-06-25','female','B-','9000000010','30 CR Park','New Delhi','110019'),
('PED-2026-0011','Arnav','Patel','2013-10-11','male','AB+','9000000011','12 Sector 50','Noida','201303'),
('PED-2026-0012','Navya','Reddy','2018-08-30','female','O-','9000000012','55 Golf Course Road','Gurugram','122011'),
('PED-2026-0013','Dhruv','Chawla','2021-01-19','male','A+','9000000013','17 Karol Bagh','New Delhi','110005'),
('PED-2026-0014','Saanvi','Mishra','2015-04-06','female','B+','9000000014','81 Dwarka Sector 6','New Delhi','110075'),
('PED-2026-0015','Vivaan','Nanda','2023-09-14','male','O+','9000000015','10 Indirapuram','Ghaziabad','201014'),
('PED-2026-0016','Meher','Saxena','2012-12-28','female','AB-','9000000016','27 Lajpat Nagar','New Delhi','110024'),
('PED-2026-0017','Atharv','Yadav','2019-05-22','male','A+','9000000017','44 Sector 15','Faridabad','121007'),
('PED-2026-0018','Inaaya','Roy','2017-09-09','female','O+','9000000018','16 Mayur Vihar','New Delhi','110091'),
('PED-2026-0019','Krish','Arora','2014-02-01','male','B+','9000000019','29 Rajouri Garden','New Delhi','110027'),
('PED-2026-0020','Anvi','Suri','2020-04-18','female','A+','9000000020','11 Sector 43','Gurugram','122009'),
('PED-2026-0021','Rudra','Mehta','2016-11-05','male','O-','9000000021','38 Vaishali','Ghaziabad','201010'),
('PED-2026-0022','Pari','Dutta','2022-06-13','female','B+','9000000022','52 Rohini','New Delhi','110085'),
('PED-2026-0023','Ayaan','Sheikh','2018-01-27','male','AB+','9000000023','9 Okhla','New Delhi','110025'),
('PED-2026-0024','Riya','Thomas','2013-03-16','female','O+','9000000024','24 Defence Colony','New Delhi','110024'),
('PED-2026-0025','Veer','Bhalla','2021-07-31','male','A-','9000000025','7 Sector 62','Noida','201309'),
('PED-2026-0026','Mira','Lal','2019-10-23','female','B+','9000000026','18 Greater Kailash','New Delhi','110048'),
('PED-2026-0027','Shaurya','Jain','2015-08-12','male','O+','9000000027','21 Pitampura','New Delhi','110034'),
('PED-2026-0028','Zara','Mirza','2023-01-08','female','A+','9000000028','33 Sector 18','Noida','201301'),
('PED-2026-0029','Neil','Bhatia','2017-12-20','male','AB+','9000000029','14 Saket','New Delhi','110017'),
('PED-2026-0030','Amaira','Kohli','2012-05-04','female','O+','9000000030','61 DLF Phase 2','Gurugram','122002');

INSERT INTO guardians (full_name,phone,email,address_line) VALUES
('Rohit Sharma','9000000001','rohit@example.test','12 Green Lane'),
('Lakshmi Iyer','9000000002','lakshmi@example.test','44 Lake View'),
('Amina Khan','9000000003','amina@example.test','8 Park Road'),
('Neel Das','9000000004','neel@example.test','71 Rose Street'),
('Priya Gupta','9000000005','guardian05@example.test','15 Ashoka Road'),
('Vikram Kapoor','9000000006','guardian06@example.test','22 Vasant Marg'),
('Maya Joshi','9000000007','guardian07@example.test','19 Sector 27'),
('Anil Menon','9000000008','guardian08@example.test','6 Palm Enclave'),
('Simran Singh','9000000009','guardian09@example.test','41 Model Town'),
('Anup Bose','9000000010','guardian10@example.test','30 CR Park'),
('Rina Patel','9000000011','guardian11@example.test','12 Sector 50'),
('Kiran Reddy','9000000012','guardian12@example.test','55 Golf Course Road'),
('Pooja Chawla','9000000013','guardian13@example.test','17 Karol Bagh'),
('Manish Mishra','9000000014','guardian14@example.test','81 Dwarka Sector 6'),
('Leena Nanda','9000000015','guardian15@example.test','10 Indirapuram'),
('Raj Saxena','9000000016','guardian16@example.test','27 Lajpat Nagar'),
('Geeta Yadav','9000000017','guardian17@example.test','44 Sector 15'),
('Soham Roy','9000000018','guardian18@example.test','16 Mayur Vihar'),
('Neha Arora','9000000019','guardian19@example.test','29 Rajouri Garden'),
('Amit Suri','9000000020','guardian20@example.test','11 Sector 43'),
('Kavita Mehta','9000000021','guardian21@example.test','38 Vaishali'),
('Rakesh Dutta','9000000022','guardian22@example.test','52 Rohini'),
('Saba Sheikh','9000000023','guardian23@example.test','9 Okhla'),
('Joseph Thomas','9000000024','guardian24@example.test','24 Defence Colony'),
('Naina Bhalla','9000000025','guardian25@example.test','7 Sector 62'),
('Sunil Lal','9000000026','guardian26@example.test','18 Greater Kailash'),
('Rekha Jain','9000000027','guardian27@example.test','21 Pitampura'),
('Omar Mirza','9000000028','guardian28@example.test','33 Sector 18'),
('Pallavi Bhatia','9000000029','guardian29@example.test','14 Saket'),
('Karan Kohli','9000000030','guardian30@example.test','61 DLF Phase 2');
INSERT INTO patient_guardians VALUES
(1,1,'father',TRUE,TRUE),(2,2,'mother',TRUE,TRUE),(3,3,'mother',TRUE,TRUE),(4,4,'father',TRUE,TRUE),
(5,5,'mother',TRUE,TRUE),(6,6,'father',TRUE,TRUE),(7,7,'mother',TRUE,TRUE),(8,8,'father',TRUE,TRUE),
(9,9,'mother',TRUE,TRUE),(10,10,'father',TRUE,TRUE),(11,11,'mother',TRUE,TRUE),(12,12,'mother',TRUE,TRUE),
(13,13,'mother',TRUE,TRUE),(14,14,'father',TRUE,TRUE),(15,15,'mother',TRUE,TRUE),(16,16,'father',TRUE,TRUE),
(17,17,'mother',TRUE,TRUE),(18,18,'father',TRUE,TRUE),(19,19,'mother',TRUE,TRUE),(20,20,'father',TRUE,TRUE),
(21,21,'mother',TRUE,TRUE),(22,22,'father',TRUE,TRUE),(23,23,'mother',TRUE,TRUE),(24,24,'father',TRUE,TRUE),
(25,25,'mother',TRUE,TRUE),(26,26,'father',TRUE,TRUE),(27,27,'mother',TRUE,TRUE),(28,28,'father',TRUE,TRUE),
(29,29,'mother',TRUE,TRUE),(30,30,'father',TRUE,TRUE);

-- STEP 3: Add appointments, visits, and sample longitudinal clinical history.
INSERT INTO appointments (patient_id,doctor_id,scheduled_at,status,reason,created_by) VALUES
(1,1,'2026-09-20 10:00:00','completed','Fever and cough',1),
(2,1,'2026-09-21 11:00:00','completed','Routine growth review',1),
(3,2,'2026-09-22 09:30:00','completed','Recurrent wheeze',1),
(4,1,'2026-09-28 12:00:00','confirmed','Vaccination review',1),
(1,2,'2026-10-04 09:00:00','scheduled','Respiratory follow-up',1),
(5,3,'2026-10-12 09:00:00','completed','Newborn feeding review',1),
(6,1,'2026-10-12 10:00:00','completed','Fever and sore throat',1),
(7,6,'2026-10-13 11:00:00','completed','Adolescent wellness review',1),
(8,4,'2026-10-13 12:00:00','no_show','Recurrent abdominal pain',1),
(9,3,'2026-10-14 09:30:00','completed','Poor appetite and weight check',1),
(10,5,'2026-10-14 10:30:00','completed','Seasonal rash',1),
(11,7,'2026-10-15 09:00:00','completed','Exercise-related cough',1),
(12,2,'2026-10-15 11:00:00','cancelled','Asthma follow-up',1),
(13,1,'2026-10-16 09:15:00','completed','Ear pain',1),
(14,4,'2026-10-16 10:15:00','completed','Constipation review',1),
(15,3,'2026-10-17 09:00:00','completed','Infant growth review',1),
(16,6,'2026-10-17 11:00:00','completed','Headache and sleep review',1),
(17,5,'2026-10-18 09:30:00','completed','Vaccination counselling',1),
(18,1,'2026-10-18 10:30:00','completed','Viral fever follow-up',1),
(19,7,'2026-10-19 09:00:00','completed','Persistent dry cough',1),
(20,4,'2026-10-19 11:00:00','completed','Reflux symptoms',1),
(21,6,'2026-10-22 09:00:00','confirmed','Sports fitness assessment',1),
(22,1,'2026-10-22 10:00:00','scheduled','Routine pediatric review',1),
(23,3,'2026-10-23 09:30:00','confirmed','Toddler growth review',1),
(24,2,'2026-10-23 11:30:00','scheduled','Wheeze follow-up',1),
(25,6,'2026-10-24 09:00:00','confirmed','Adolescent nutrition review',1),
(26,5,'2026-10-24 10:30:00','scheduled','Allergy review',1),
(27,1,'2026-10-26 09:00:00','confirmed','School health review',1),
(28,3,'2026-10-26 11:00:00','scheduled','Infant vaccination visit',1),
(29,7,'2026-10-27 09:30:00','confirmed','Respiratory review',1),
(30,4,'2026-10-27 11:00:00','scheduled','Abdominal pain review',1);

INSERT INTO visits (appointment_id,patient_id,doctor_id,visit_started_at,visit_ended_at,chief_complaint,disposition) VALUES
(1,1,1,'2026-09-20 10:02:00','2026-09-20 10:25:00','Fever for two days with dry cough','home'),
(2,2,1,'2026-09-21 11:03:00','2026-09-21 11:22:00','Scheduled growth and nutrition assessment','home'),
(3,3,2,'2026-09-22 09:31:00','2026-09-22 10:05:00','Night-time wheeze and exertional cough','home'),
(6,5,3,'2026-10-12 09:02:00','2026-10-12 09:28:00','Feeding pattern review','home'),
(7,6,1,'2026-10-12 10:03:00','2026-10-12 10:24:00','Fever and sore throat','home'),
(8,7,6,'2026-10-13 11:04:00','2026-10-13 11:31:00','Preventive adolescent health review','home'),
(10,9,3,'2026-10-14 09:33:00','2026-10-14 10:01:00','Poor appetite','home'),
(11,10,5,'2026-10-14 10:32:00','2026-10-14 10:55:00','Itchy seasonal rash','home'),
(12,11,7,'2026-10-15 09:02:00','2026-10-15 09:36:00','Cough during exercise','home'),
(14,13,1,'2026-10-16 09:17:00','2026-10-16 09:42:00','Right ear pain','home'),
(15,14,4,'2026-10-16 10:18:00','2026-10-16 10:47:00','Constipation','home'),
(16,15,3,'2026-10-17 09:03:00','2026-10-17 09:29:00','Growth and feeding assessment','home'),
(17,16,6,'2026-10-17 11:03:00','2026-10-17 11:37:00','Intermittent headache','home'),
(18,17,5,'2026-10-18 09:32:00','2026-10-18 09:54:00','Immunization counselling','home'),
(19,18,1,'2026-10-18 10:33:00','2026-10-18 10:59:00','Fever follow-up','home'),
(20,19,7,'2026-10-19 09:02:00','2026-10-19 09:35:00','Persistent dry cough','home'),
(21,20,4,'2026-10-19 11:03:00','2026-10-19 11:31:00','Post-meal reflux symptoms','home');

INSERT INTO medical_records (visit_id,history,examination,clinical_notes,recorded_by) VALUES
(1,'No breathing difficulty; oral intake maintained.','Alert, mild pharyngeal erythema, chest clear.','Likely viral upper respiratory infection.',2),
(2,'Balanced diet; no parental concerns.','Active child; examination normal.','Growth tracking within expected range.',2),
(3,'Three similar episodes in six months.','Mild expiratory wheeze; no retractions.','Trial bronchodilator and symptom diary.',3),
(4,'Feeding every three hours; adequate wet diapers.','Alert infant; hydration and tone normal.','Growth and feeding are appropriate.',5),
(5,'Fever since yesterday; tolerating fluids.','Mild pharyngeal erythema; chest clear.','Supportive care and return precautions discussed.',2),
(6,'No acute concerns; sleep and school performance reviewed.','General examination normal.','Preventive counselling completed.',8),
(7,'Reduced appetite for one week.','Hydrated; abdominal examination normal.','Diet diary and weight monitoring advised.',5),
(8,'Intermittent itchy rash after outdoor play.','Scattered mild urticaria; no respiratory signs.','Trigger avoidance and skin care reviewed.',7),
(9,'Dry cough during running; no symptoms at rest.','Air entry equal; no current wheeze.','Peak-flow diary and follow-up planned.',9),
(10,'Ear pain for one day without discharge.','Right tympanic membrane mildly erythematous.','Analgesia and observation advised.',2),
(11,'Hard stools three times weekly.','Abdomen soft and non-tender.','Hydration, fibre and toileting plan reviewed.',6),
(12,'Routine infant growth assessment.','Development and examination appropriate for age.','Continue age-appropriate feeding.',5),
(13,'Headache after late nights and screen use.','Neurologic examination normal.','Sleep hygiene and symptom log advised.',8),
(14,'Vaccination record reviewed with guardian.','No contraindication identified.','Catch-up schedule discussed.',7),
(15,'Fever resolved; energy and appetite improving.','Afebrile; examination reassuring.','No further treatment required.',2),
(16,'Dry cough for two weeks.','No distress; mild expiratory wheeze.','Inhaler technique reviewed.',9),
(17,'Burning after meals twice weekly.','Abdomen soft; growth stable.','Meal timing and reflux precautions reviewed.',6);

INSERT INTO diagnoses (medical_record_id,icd_code,diagnosis_name,diagnosis_type,is_primary) VALUES
(1,'J06.9','Acute upper respiratory infection','confirmed',TRUE),
(2,'Z00.1','Routine child health examination','confirmed',TRUE),
(3,'J45.909','Suspected childhood asthma','provisional',TRUE);
INSERT INTO treatments (medical_record_id,treatment_name,instructions,started_on,ended_on) VALUES
(1,'Supportive care','Fluids, rest, return if respiratory distress develops','2026-09-20','2026-09-25'),
(3,'Metered-dose inhaler trial','Use with spacer as demonstrated','2026-09-22',NULL);

INSERT INTO vital_signs (visit_id,temperature_c,heart_rate_bpm,respiratory_rate_bpm,systolic_bp,diastolic_bp,oxygen_saturation,measured_at,measured_by) VALUES
(1,38.1,104,22,102,65,98,'2026-09-20 10:04:00',4),
(2,36.7,92,20,98,60,99,'2026-09-21 11:05:00',4),
(3,36.8,108,26,106,68,96,'2026-09-22 09:34:00',4),
(4,36.7,118,30,82,48,99,'2026-10-12 09:05:00',4),
(5,38.0,102,22,100,62,98,'2026-10-12 10:06:00',4),
(6,36.6,78,18,110,70,99,'2026-10-13 11:07:00',4),
(7,36.8,96,21,98,60,99,'2026-10-14 09:36:00',4),
(8,36.7,88,19,104,66,99,'2026-10-14 10:35:00',4),
(9,36.8,92,22,108,68,97,'2026-10-15 09:05:00',4),
(10,37.2,98,21,100,64,99,'2026-10-16 09:20:00',4),
(11,36.6,86,18,106,66,99,'2026-10-16 10:21:00',4),
(12,36.7,112,28,84,50,99,'2026-10-17 09:06:00',4),
(13,36.5,76,17,112,72,99,'2026-10-17 11:06:00',4),
(14,36.7,90,20,102,64,99,'2026-10-18 09:35:00',4),
(15,36.9,94,20,104,65,99,'2026-10-18 10:36:00',4),
(16,36.8,96,22,108,68,97,'2026-10-19 09:05:00',4),
(17,36.6,84,18,106,66,99,'2026-10-19 11:06:00',4);
INSERT INTO growth_records (visit_id,patient_id,height_cm,weight_kg,head_circumference_cm,height_percentile,weight_percentile,measured_at) VALUES
(1,1,128.4,27.2,NULL,58,62,'2026-09-20 10:05:00'),
(2,2,103.2,16.4,NULL,55,51,'2026-09-21 11:06:00'),
(3,3,149.1,43.6,NULL,67,64,'2026-09-22 09:35:00');

INSERT INTO allergies (patient_id,allergen,reaction,severity) VALUES
(1,'Penicillin','Urticaria','moderate'),(3,'House dust mite','Wheeze','moderate');
INSERT INTO immunizations (patient_id,vaccine_name,dose_number,administered_on,lot_number,administered_by) VALUES
(2,'DTaP',4,'2025-09-10','DT-22811',1),(4,'MMR',1,'2024-05-20','MM-77621',1);

INSERT INTO medications (generic_name,brand_name,form,strength) VALUES
('Paracetamol',NULL,'oral suspension','250 mg/5 mL'),
('Salbutamol',NULL,'metered-dose inhaler','100 mcg/actuation');
INSERT INTO prescriptions (visit_id,patient_id,doctor_id,prescribed_at,notes) VALUES
(1,1,1,'2026-09-20 10:20:00','Use only for fever or discomfort'),
(3,3,2,'2026-09-22 09:58:00','Spacer technique demonstrated');
INSERT INTO prescription_items (prescription_id,medication_id,dose,frequency,route,duration_days,instructions) VALUES
(1,1,'10 mL','Every 6 hours as needed','oral',3,'Maximum four doses daily'),
(2,2,'2 puffs','Every 6 hours as needed','inhaled',14,'Use spacer; seek care if not relieved');

INSERT INTO lab_tests (test_code,test_name,unit,reference_range) VALUES
('CBC-WBC','White blood cell count','10^9/L','5.0-14.5'),('HGB','Hemoglobin','g/dL','11.5-15.5');
INSERT INTO lab_orders (visit_id,lab_test_id,ordered_by,status,ordered_at) VALUES
(3,1,2,'completed','2026-09-22 09:50:00');
INSERT INTO lab_results (lab_order_id,result_value,is_abnormal,resulted_at) VALUES
(1,'8.7',FALSE,'2026-09-22 15:30:00');
INSERT INTO follow_ups (visit_id,assigned_doctor_id,assigned_user_id,due_date,reason,status,appointment_id) VALUES
(1,1,2,'2026-09-27','Review if fever persists','pending',NULL),
(3,2,3,'2026-10-04','Assess inhaler response','scheduled',5);

-- STEP 4: Add examples for both supported dynamic-data designs.
-- custom_forms stores a whole questionnaire response as a JSON object.
-- clinical_custom_fields stores one JSON value per field and clinical record.
INSERT INTO custom_forms (form_key,form_name,description,version,status,created_by) VALUES
('asthma_review','Pediatric Asthma Review','Structured symptom and control assessment',1,'active',1);
INSERT INTO custom_form_fields
  (form_id,field_key,label,field_type,help_text,options,validation_rules,
   section_name,section_order,display_order,is_required,default_value)
VALUES
  (1,'night_symptoms','Night-time symptoms','dropdown','Frequency in the previous four weeks',
   JSON_ARRAY(JSON_OBJECT('value','none','label','None'),
              JSON_OBJECT('value','monthly','label','1-3 nights/month'),
              JSON_OBJECT('value','weekly','label','1+ nights/week')),
   JSON_OBJECT(),'Current symptoms',1,1,TRUE,NULL),
  (1,'reliever_days','Reliever use (days/week)','number','Enter 0 through 7',
   NULL,JSON_OBJECT('min',0,'max',7),'Current symptoms',1,2,TRUE,NULL),
  (1,'activity_limited','Activity limitation','boolean','Does asthma limit normal activity?',
   NULL,JSON_OBJECT(),'Current symptoms',1,3,FALSE,CAST('false' AS JSON)),
  (1,'assessment_note','Assessment note','textarea','Brief clinical interpretation',
   NULL,JSON_OBJECT('maxLength',1000),'Clinical assessment',2,1,FALSE,NULL);

INSERT INTO custom_form_responses
  (form_id,visit_id,answers,extra_fields,recorded_by,version)
VALUES
  (1,3,JSON_OBJECT(
     'night_symptoms','weekly',
     'reliever_days',4,
     'activity_limited',TRUE,
     'assessment_note','Symptoms suggest incomplete control; review response after two weeks.'
   ),NULL,3,1);

INSERT INTO custom_form_response_history
  (response_id,version,answers,extra_fields,changed_by)
SELECT response_id,version,answers,extra_fields,recorded_by
FROM custom_form_responses;

INSERT INTO clinical_custom_fields
  (context_type,field_key,label,field_type,help_text,options,validation_rules,section_name,display_order,is_required,created_by)
VALUES
('follow_up','diagnosis','Primary Diagnosis','dropdown','Primary clinical indication',JSON_ARRAY('Atopic Dermatitis (Severe)','Atopic Dermatitis (Moderate)','Pediatric Eczema Flare','Childhood Asthma','Prurigo Nodularis','Routine Pediatric Health'),JSON_OBJECT(),'AD & ST Registry',1,FALSE,1),
('follow_up','systemic_therapy','Systemic Therapy','dropdown','Current systemic or topical regimen',JSON_ARRAY('Methotrexate 10mg/wk','Cyclosporine 3mg/kg','Dupilumab 200mg Q2W','Prednisolone Taper','Azathioprine','Topical Calcineurin Inhibitor','Topical Corticosteroids only','None / Washout'),JSON_OBJECT(),'AD & ST Registry',2,FALSE,1),
('follow_up','severity_score','Severity (EASI / SCORAD)','text','Record the score and scale',NULL,JSON_OBJECT('maxLength',120),'AD & ST Registry',3,FALSE,1),
('follow_up','lab_status','Safety Lab Status','dropdown','Monitoring status',JSON_ARRAY('CBC & LFT Due','Safety Labs Normal','Pending Blood Draw','Liver Enzymes Monitored','Urine Routine Clear','Not Required'),JSON_OBJECT(),'AD & ST Registry',4,FALSE,1),
('follow_up','protocol_week','Protocol Phase','dropdown','Current treatment phase',JSON_ARRAY('Baseline / Screening','Week 2 Safety Check','Week 4 Early Response','Week 8 Review','Week 12 Efficacy Endpoint','Week 24 Maintenance','Long-term Follow-up'),JSON_OBJECT(),'AD & ST Registry',5,FALSE,1),
('follow_up','treatment_response','Clinical Response','dropdown','Latest treatment response',JSON_ARRAY('EASI-50 Achieved','EASI-75 Achieved','Partial Control','Stable on Therapy','Disease Flare-up','Awaiting Assessment'),JSON_OBJECT(),'AD & ST Registry',6,FALSE,1);

INSERT INTO patient_identifiers(patient_id,identifier_type,identifier_value,is_primary)
SELECT patient_id,'hospital_mrn',medical_record_number,TRUE FROM patients;


-- Additional historical records make the patient continuity view demonstrable.
INSERT INTO follow_ups
  (visit_id,category,priority,assigned_doctor_id,assigned_user_id,due_date,reason,status,
   contact_channel,contact_status,next_action,outcome,completed_at)
SELECT 1,'clinical_review','routine',1,2,'2026-09-15','Telephone review after previous fever','completed',
       'phone','reached',NULL,'Guardian reported full recovery and normal oral intake.','2026-09-15 11:20:00';

INSERT INTO follow_ups
  (visit_id,category,priority,assigned_doctor_id,assigned_user_id,due_date,reason,status,
   contact_channel,contact_status,next_action,outcome,completed_at)
SELECT 3,'clinical_review','routine',2,3,'2026-09-10','Review prior wheeze episode','completed',
       'phone','reached',NULL,'Symptoms reduced after inhaler teaching; later recurrence led to the current review.','2026-09-10 16:10:00';

INSERT INTO follow_up_notes(follow_up_id,author_user_id,note_type,note_text,contact_channel)
SELECT f.follow_up_id,1,'contact_attempt','Guardian reached by phone; recovery and safety advice documented.','phone'
FROM follow_ups f
WHERE f.reason='Telephone review after previous fever';

INSERT INTO follow_up_notes(follow_up_id,author_user_id,note_type,note_text,contact_channel)
SELECT f.follow_up_id,1,'clinical','Symptom response reviewed and return precautions reinforced.','phone'
FROM follow_ups f
WHERE f.reason='Review prior wheeze episode';

-- Demonstration values for the database-backed follow-up field definitions.
-- Each value is JSON, but remains linked relationally to its field and follow-up.
INSERT INTO clinical_custom_field_values(custom_field_id,follow_up_id,value_json,recorded_by)
SELECT cf.custom_field_id,f.follow_up_id,
  JSON_QUOTE(CASE cf.field_key
    WHEN 'diagnosis' THEN CASE MOD(f.follow_up_id,3)
      WHEN 0 THEN 'Pediatric Eczema Flare' WHEN 1 THEN 'Atopic Dermatitis (Moderate)' ELSE 'Childhood Asthma' END
    WHEN 'systemic_therapy' THEN CASE MOD(f.follow_up_id,3)
      WHEN 0 THEN 'Topical Corticosteroids only' WHEN 1 THEN 'Methotrexate 10mg/wk' ELSE 'None / Washout' END
    WHEN 'severity_score' THEN CONCAT('EASI: ',8 + MOD(f.follow_up_id * 3,18),'.0')
    WHEN 'lab_status' THEN CASE MOD(f.follow_up_id,3)
      WHEN 0 THEN 'Safety Labs Normal' WHEN 1 THEN 'CBC & LFT Due' ELSE 'Not Required' END
    WHEN 'protocol_week' THEN CASE MOD(f.follow_up_id,3)
      WHEN 0 THEN 'Week 4 Early Response' WHEN 1 THEN 'Week 12 Efficacy Endpoint' ELSE 'Baseline / Screening' END
    WHEN 'treatment_response' THEN CASE MOD(f.follow_up_id,3)
      WHEN 0 THEN 'Stable on Therapy' WHEN 1 THEN 'EASI-50 Achieved' ELSE 'Awaiting Assessment' END
  END),1
FROM follow_ups f
JOIN clinical_custom_fields cf
  ON cf.context_type='follow_up' AND cf.deleted_at IS NULL
WHERE f.deleted_at IS NULL;

INSERT INTO clinical_custom_field_value_history(custom_value_id,version,value_json,changed_by)
SELECT cv.custom_value_id,cv.version,cv.value_json,cv.recorded_by
FROM clinical_custom_field_values cv
JOIN clinical_custom_fields cf USING(custom_field_id)
WHERE cf.context_type='follow_up';

COMMIT;

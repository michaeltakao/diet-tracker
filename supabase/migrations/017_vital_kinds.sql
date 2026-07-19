-- 017: Lipid-panel + HbA1c vital kinds (phase C).
--
-- Same stance as 013: RECORD ONLY, wide plausibility bounds as data-entry
-- guards — the app never interprets these values.
--
-- Constraint names verified against prod 2026-07-19 (\d-equivalent query):
--   vital_logs_kind_check  — auto-named inline CHECK from 013
--   vital_logs_kind_shape  — explicit XOR from 013
-- Existing blood_pressure / blood_glucose rows satisfy the recreated CHECKs
-- (all new columns NULL); the table is small, so full validation on ADD is fine.

ALTER TABLE public.vital_logs
  ADD COLUMN total_chol_mg_dl    SMALLINT     CHECK (total_chol_mg_dl    BETWEEN 50 AND 500),
  ADD COLUMN ldl_mg_dl           SMALLINT     CHECK (ldl_mg_dl           BETWEEN 20 AND 400),
  ADD COLUMN hdl_mg_dl           SMALLINT     CHECK (hdl_mg_dl           BETWEEN 10 AND 150),
  ADD COLUMN triglycerides_mg_dl SMALLINT     CHECK (triglycerides_mg_dl BETWEEN 20 AND 2000),
  ADD COLUMN hba1c_percent       NUMERIC(3,1) CHECK (hba1c_percent       BETWEEN 3 AND 20);

ALTER TABLE public.vital_logs DROP CONSTRAINT vital_logs_kind_check;
ALTER TABLE public.vital_logs DROP CONSTRAINT vital_logs_kind_shape;

ALTER TABLE public.vital_logs ADD CONSTRAINT vital_logs_kind_check
  CHECK (kind IN ('blood_pressure', 'blood_glucose', 'lipid', 'hba1c'));

-- XOR: exactly the columns of the declared kind, nothing of the others.
-- Lipid anchor = total cholesterol (LDL/HDL/TG optional — labs vary).
ALTER TABLE public.vital_logs ADD CONSTRAINT vital_logs_kind_shape CHECK (
  (kind = 'blood_pressure'
    AND systolic IS NOT NULL AND diastolic IS NOT NULL
    AND glucose_mg_dl IS NULL AND glucose_context IS NULL
    AND total_chol_mg_dl IS NULL AND ldl_mg_dl IS NULL AND hdl_mg_dl IS NULL
    AND triglycerides_mg_dl IS NULL AND hba1c_percent IS NULL)
  OR
  (kind = 'blood_glucose'
    AND glucose_mg_dl IS NOT NULL AND glucose_context IS NOT NULL
    AND systolic IS NULL AND diastolic IS NULL
    AND total_chol_mg_dl IS NULL AND ldl_mg_dl IS NULL AND hdl_mg_dl IS NULL
    AND triglycerides_mg_dl IS NULL AND hba1c_percent IS NULL)
  OR
  (kind = 'lipid'
    AND total_chol_mg_dl IS NOT NULL
    AND systolic IS NULL AND diastolic IS NULL
    AND glucose_mg_dl IS NULL AND glucose_context IS NULL
    AND hba1c_percent IS NULL)
  OR
  (kind = 'hba1c'
    AND hba1c_percent IS NOT NULL
    AND systolic IS NULL AND diastolic IS NULL
    AND glucose_mg_dl IS NULL AND glucose_context IS NULL
    AND total_chol_mg_dl IS NULL AND ldl_mg_dl IS NULL AND hdl_mg_dl IS NULL
    AND triglycerides_mg_dl IS NULL)
);

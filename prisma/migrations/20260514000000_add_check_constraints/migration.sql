-- Add CHECK constraints to enforce documented day/time bounds.
--
-- dayIndex   : 0–6  (Mon=0 … Sun=6)
-- *TimeMin   : 0–1440  (0 = midnight, 1440 = midnight next day)
-- *StartMin / *EndMin : 0–1440 (nullable columns must also allow NULL)
-- cycleWeeks : 1–12  (enforced in service layer; mirrored here)
-- weekIndex  : >= 0

-- ─── TimetableTemplateEntry ───────────────────────────────────────────────────
-- dayIndex upper-bound is variable (cycleLengthDays), so only a lower-bound is enforced.
ALTER TABLE "TimetableTemplateEntry"
  ADD CONSTRAINT "TimetableTemplateEntry_dayIndex_check"
    CHECK ("dayIndex" >= 0),
  ADD CONSTRAINT "TimetableTemplateEntry_startTimeMin_check"
    CHECK ("startTimeMin" >= 0 AND "startTimeMin" <= 1439),
  ADD CONSTRAINT "TimetableTemplateEntry_endTimeMin_check"
    CHECK ("endTimeMin" >= 0 AND "endTimeMin" <= 1439);

-- ─── RosterEntry ─────────────────────────────────────────────────────────────
ALTER TABLE "RosterEntry"
  ADD CONSTRAINT "RosterEntry_dayIndex_check"
    CHECK ("dayIndex" >= 0 AND "dayIndex" <= 6),
  ADD CONSTRAINT "RosterEntry_shiftStartMin_check"
    CHECK ("shiftStartMin" IS NULL OR ("shiftStartMin" >= 0 AND "shiftStartMin" <= 1440)),
  ADD CONSTRAINT "RosterEntry_shiftEndMin_check"
    CHECK ("shiftEndMin" IS NULL OR ("shiftEndMin" >= 0 AND "shiftEndMin" <= 1440));

-- ─── RosterDayConfig ─────────────────────────────────────────────────────────
ALTER TABLE "RosterDayConfig"
  ADD CONSTRAINT "RosterDayConfig_dayIndex_check"
    CHECK ("dayIndex" >= 0 AND "dayIndex" <= 6),
  ADD CONSTRAINT "RosterDayConfig_openTimeMin_check"
    CHECK ("openTimeMin" IS NULL OR ("openTimeMin" >= 0 AND "openTimeMin" <= 1440)),
  ADD CONSTRAINT "RosterDayConfig_closeTimeMin_check"
    CHECK ("closeTimeMin" IS NULL OR ("closeTimeMin" >= 0 AND "closeTimeMin" <= 1440));

-- ─── RosterTemplate ──────────────────────────────────────────────────────────
ALTER TABLE "RosterTemplate"
  ADD CONSTRAINT "RosterTemplate_cycleWeeks_check"
    CHECK ("cycleWeeks" >= 1 AND "cycleWeeks" <= 12);

-- ─── RosterTemplateEntry ─────────────────────────────────────────────────────
ALTER TABLE "RosterTemplateEntry"
  ADD CONSTRAINT "RosterTemplateEntry_weekIndex_check"
    CHECK ("weekIndex" >= 0),
  ADD CONSTRAINT "RosterTemplateEntry_dayIndex_check"
    CHECK ("dayIndex" >= 0 AND "dayIndex" <= 6),
  ADD CONSTRAINT "RosterTemplateEntry_shiftStartMin_check"
    CHECK ("shiftStartMin" IS NULL OR ("shiftStartMin" >= 0 AND "shiftStartMin" <= 1440)),
  ADD CONSTRAINT "RosterTemplateEntry_shiftEndMin_check"
    CHECK ("shiftEndMin" IS NULL OR ("shiftEndMin" >= 0 AND "shiftEndMin" <= 1440));

UPDATE mobilebg_backups
SET vat_included = CASE
  WHEN vat_included IN ('included', 'exempt', 'excluded') THEN vat_included
  WHEN vat_included IN (1, '1') THEN 'included'
  WHEN vat_included IN (0, '0') THEN 'exempt'
  ELSE NULL
END;

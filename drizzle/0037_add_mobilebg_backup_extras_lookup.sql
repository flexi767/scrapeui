CREATE TABLE IF NOT EXISTS `mobilebg_backup_extras` (
  `backup_id` integer NOT NULL,
  `extra_label` text NOT NULL,
  FOREIGN KEY (`backup_id`) REFERENCES `mobilebg_backups`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `mobilebg_backup_extras_unique_idx`
ON `mobilebg_backup_extras` (`backup_id`, `extra_label`);

CREATE INDEX IF NOT EXISTS `mobilebg_backup_extras_label_backup_idx`
ON `mobilebg_backup_extras` (`extra_label`, `backup_id`);

DELETE FROM `mobilebg_backup_extras`;

INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
SELECT b.`id`, item.`value`
FROM (
  SELECT `id`, `extras_json`
  FROM `mobilebg_backups`
  WHERE `extras_json` IS NOT NULL AND json_valid(`extras_json`)
) b, json_each(b.`extras_json`) item
WHERE json_type(b.`extras_json`) = 'array'
  AND item.`type` = 'text'
  AND item.`value` != '';

INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
SELECT
  b.`id`,
  CASE
    WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
    ELSE item.`value`
  END
FROM (
  SELECT `id`, `extras_json`
  FROM `mobilebg_backups`
  WHERE `extras_json` IS NOT NULL AND json_valid(`extras_json`)
) b, json_each(b.`extras_json`) category, json_each(
  CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END
) item
WHERE json_type(b.`extras_json`) = 'object'
  AND category.`type` = 'array'
  AND (
    (item.`type` = 'text' AND item.`value` != '')
    OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
  );

CREATE TRIGGER IF NOT EXISTS `mobilebg_backup_extras_after_insert`
AFTER INSERT ON `mobilebg_backups`
WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`)
BEGIN
  INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
  SELECT new.`id`, item.`value`
  FROM json_each(new.`extras_json`) item
  WHERE json_type(new.`extras_json`) = 'array'
    AND item.`type` = 'text'
    AND item.`value` != '';

  INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
  SELECT
    new.`id`,
    CASE
      WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
      ELSE item.`value`
    END
  FROM json_each(new.`extras_json`) category,
       json_each(CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END) item
  WHERE json_type(new.`extras_json`) = 'object'
    AND category.`type` = 'array'
    AND (
      (item.`type` = 'text' AND item.`value` != '')
      OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
    );
END;

CREATE TRIGGER IF NOT EXISTS `mobilebg_backup_extras_after_update`
AFTER UPDATE OF `extras_json` ON `mobilebg_backups`
BEGIN
  DELETE FROM `mobilebg_backup_extras` WHERE `backup_id` = new.`id`;

  INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
  SELECT new.`id`, item.`value`
  FROM json_each(CASE WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`) THEN new.`extras_json` ELSE '[]' END) item
  WHERE new.`extras_json` IS NOT NULL
    AND json_valid(new.`extras_json`)
    AND json_type(new.`extras_json`) = 'array'
    AND item.`type` = 'text'
    AND item.`value` != '';

  INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
  SELECT
    new.`id`,
    CASE
      WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
      ELSE item.`value`
    END
  FROM json_each(CASE WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`) THEN new.`extras_json` ELSE '{}' END) category,
       json_each(CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END) item
  WHERE new.`extras_json` IS NOT NULL
    AND json_valid(new.`extras_json`)
    AND json_type(new.`extras_json`) = 'object'
    AND category.`type` = 'array'
    AND (
      (item.`type` = 'text' AND item.`value` != '')
      OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
    );
END;

CREATE TRIGGER IF NOT EXISTS `mobilebg_backup_extras_after_delete`
AFTER DELETE ON `mobilebg_backups`
BEGIN
  DELETE FROM `mobilebg_backup_extras` WHERE `backup_id` = old.`id`;
END;

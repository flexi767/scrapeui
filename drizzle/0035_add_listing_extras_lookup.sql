CREATE TABLE IF NOT EXISTS `listing_extras` (
  `listing_id` integer NOT NULL,
  `extra_label` text NOT NULL,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `listing_extras_unique_idx`
ON `listing_extras` (`listing_id`, `extra_label`);

CREATE INDEX IF NOT EXISTS `listing_extras_label_listing_idx`
ON `listing_extras` (`extra_label`, `listing_id`);

DELETE FROM `listing_extras`;

INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
SELECT l.`id`, item.`value`
FROM (
  SELECT `id`, `extras_json`
  FROM `listings`
  WHERE `extras_json` IS NOT NULL AND json_valid(`extras_json`)
) l, json_each(l.`extras_json`) item
WHERE json_type(l.`extras_json`) = 'array'
  AND item.`type` = 'text'
  AND item.`value` != '';

INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
SELECT
  l.`id`,
  CASE
    WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
    ELSE item.`value`
  END
FROM (
  SELECT `id`, `extras_json`
  FROM `listings`
  WHERE `extras_json` IS NOT NULL AND json_valid(`extras_json`)
) l, json_each(l.`extras_json`) category, json_each(
  CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END
) item
WHERE json_type(l.`extras_json`) = 'object'
  AND category.`type` = 'array'
  AND (
    (item.`type` = 'text' AND item.`value` != '')
    OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
  );

CREATE TRIGGER IF NOT EXISTS `listing_extras_after_insert`
AFTER INSERT ON `listings`
WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`)
BEGIN
  INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
  SELECT new.`id`, item.`value`
  FROM json_each(new.`extras_json`) item
  WHERE json_type(new.`extras_json`) = 'array'
    AND item.`type` = 'text'
    AND item.`value` != '';

  INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
  SELECT
    new.`id`,
    CASE
      WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
      ELSE item.`value`
    END
  FROM json_each(new.`extras_json`) category, json_each(
    CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END
  ) item
  WHERE json_type(new.`extras_json`) = 'object'
    AND category.`type` = 'array'
    AND (
      (item.`type` = 'text' AND item.`value` != '')
      OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
    );
END;

CREATE TRIGGER IF NOT EXISTS `listing_extras_after_update`
AFTER UPDATE OF `extras_json` ON `listings`
BEGIN
  DELETE FROM `listing_extras` WHERE `listing_id` = new.`id`;

  INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
  SELECT new.`id`, item.`value`
  FROM json_each(CASE WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`) THEN new.`extras_json` ELSE '[]' END) item
  WHERE new.`extras_json` IS NOT NULL
    AND json_valid(new.`extras_json`)
    AND json_type(new.`extras_json`) = 'array'
    AND item.`type` = 'text'
    AND item.`value` != '';

  INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
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

CREATE TRIGGER IF NOT EXISTS `listing_extras_after_delete`
AFTER DELETE ON `listings`
BEGIN
  DELETE FROM `listing_extras` WHERE `listing_id` = old.`id`;
END;

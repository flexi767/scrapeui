CREATE VIRTUAL TABLE IF NOT EXISTS `listing_change_search_fts`
USING fts5(
  `title`,
  `make`,
  `model`,
  `description`,
  content='listings',
  content_rowid='id',
  tokenize='unicode61'
);

INSERT INTO `listing_change_search_fts` (`listing_change_search_fts`) VALUES ('rebuild');

CREATE TRIGGER IF NOT EXISTS `listing_change_search_fts_after_insert`
AFTER INSERT ON `listings`
BEGIN
  INSERT INTO `listing_change_search_fts` (`rowid`, `title`, `make`, `model`, `description`)
  VALUES (new.`id`, COALESCE(new.`title`, ''), COALESCE(new.`make`, ''), COALESCE(new.`model`, ''), COALESCE(new.`description`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `listing_change_search_fts_after_delete`
AFTER DELETE ON `listings`
BEGIN
  INSERT INTO `listing_change_search_fts` (`listing_change_search_fts`, `rowid`, `title`, `make`, `model`, `description`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''), COALESCE(old.`make`, ''), COALESCE(old.`model`, ''), COALESCE(old.`description`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `listing_change_search_fts_after_update`
AFTER UPDATE OF `title`, `make`, `model`, `description` ON `listings`
BEGIN
  INSERT INTO `listing_change_search_fts` (`listing_change_search_fts`, `rowid`, `title`, `make`, `model`, `description`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''), COALESCE(old.`make`, ''), COALESCE(old.`model`, ''), COALESCE(old.`description`, ''));
  INSERT INTO `listing_change_search_fts` (`rowid`, `title`, `make`, `model`, `description`)
  VALUES (new.`id`, COALESCE(new.`title`, ''), COALESCE(new.`make`, ''), COALESCE(new.`model`, ''), COALESCE(new.`description`, ''));
END;

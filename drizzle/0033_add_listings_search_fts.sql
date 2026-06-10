CREATE VIRTUAL TABLE IF NOT EXISTS `listings_search_fts`
USING fts5(
  `title`,
  `make`,
  `model`,
  content='listings',
  content_rowid='id',
  tokenize='unicode61'
);

INSERT INTO `listings_search_fts` (`listings_search_fts`) VALUES ('rebuild');

CREATE TRIGGER IF NOT EXISTS `listings_search_fts_after_insert`
AFTER INSERT ON `listings`
BEGIN
  INSERT INTO `listings_search_fts` (`rowid`, `title`, `make`, `model`)
  VALUES (new.`id`, COALESCE(new.`title`, ''), COALESCE(new.`make`, ''), COALESCE(new.`model`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `listings_search_fts_after_delete`
AFTER DELETE ON `listings`
BEGIN
  INSERT INTO `listings_search_fts` (`listings_search_fts`, `rowid`, `title`, `make`, `model`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''), COALESCE(old.`make`, ''), COALESCE(old.`model`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `listings_search_fts_after_update`
AFTER UPDATE OF `title`, `make`, `model` ON `listings`
BEGIN
  INSERT INTO `listings_search_fts` (`listings_search_fts`, `rowid`, `title`, `make`, `model`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''), COALESCE(old.`make`, ''), COALESCE(old.`model`, ''));
  INSERT INTO `listings_search_fts` (`rowid`, `title`, `make`, `model`)
  VALUES (new.`id`, COALESCE(new.`title`, ''), COALESCE(new.`make`, ''), COALESCE(new.`model`, ''));
END;

CREATE VIRTUAL TABLE IF NOT EXISTS `tasks_search_fts`
USING fts5(
  `title`,
  content='tasks',
  content_rowid='id',
  tokenize='unicode61'
);

INSERT INTO `tasks_search_fts` (`tasks_search_fts`) VALUES ('rebuild');

CREATE TRIGGER IF NOT EXISTS `tasks_search_fts_after_insert`
AFTER INSERT ON `tasks`
BEGIN
  INSERT INTO `tasks_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `tasks_search_fts_after_delete`
AFTER DELETE ON `tasks`
BEGIN
  INSERT INTO `tasks_search_fts` (`tasks_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `tasks_search_fts_after_update`
AFTER UPDATE OF `title` ON `tasks`
BEGIN
  INSERT INTO `tasks_search_fts` (`tasks_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
  INSERT INTO `tasks_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;

CREATE VIRTUAL TABLE IF NOT EXISTS `expenses_search_fts`
USING fts5(
  `title`,
  content='expenses',
  content_rowid='id',
  tokenize='unicode61'
);

INSERT INTO `expenses_search_fts` (`expenses_search_fts`) VALUES ('rebuild');

CREATE TRIGGER IF NOT EXISTS `expenses_search_fts_after_insert`
AFTER INSERT ON `expenses`
BEGIN
  INSERT INTO `expenses_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `expenses_search_fts_after_delete`
AFTER DELETE ON `expenses`
BEGIN
  INSERT INTO `expenses_search_fts` (`expenses_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `expenses_search_fts_after_update`
AFTER UPDATE OF `title` ON `expenses`
BEGIN
  INSERT INTO `expenses_search_fts` (`expenses_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
  INSERT INTO `expenses_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;

CREATE VIRTUAL TABLE IF NOT EXISTS `articles_search_fts`
USING fts5(
  `title`,
  content='articles',
  content_rowid='id',
  tokenize='unicode61'
);

INSERT INTO `articles_search_fts` (`articles_search_fts`) VALUES ('rebuild');

CREATE TRIGGER IF NOT EXISTS `articles_search_fts_after_insert`
AFTER INSERT ON `articles`
BEGIN
  INSERT INTO `articles_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `articles_search_fts_after_delete`
AFTER DELETE ON `articles`
BEGIN
  INSERT INTO `articles_search_fts` (`articles_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
END;

CREATE TRIGGER IF NOT EXISTS `articles_search_fts_after_update`
AFTER UPDATE OF `title` ON `articles`
BEGIN
  INSERT INTO `articles_search_fts` (`articles_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
  INSERT INTO `articles_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;

CREATE TABLE `mobilebg_make_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`search_path` text DEFAULT '/search/avtomobili-dzhipove' NOT NULL,
	`pubtype` text DEFAULT '1,2' NOT NULL,
	`make` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`make_id` integer,
	`model_id` integer,
	`make_count` integer,
	`model_count` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mobilebg_make_models_scope_make_model_idx` ON `mobilebg_make_models` (`search_path`,`pubtype`,`make`,`model`);

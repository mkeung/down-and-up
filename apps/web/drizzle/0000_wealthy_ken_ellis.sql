CREATE TABLE "audio_deletions" (
	"object_key" text PRIMARY KEY NOT NULL,
	"namespace" text NOT NULL,
	"delete_after" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"profile_id" text NOT NULL,
	"date" date NOT NULL,
	"value" smallint,
	"value_updated_at" timestamp with time zone,
	"note" text,
	"note_updated_at" timestamp with time zone,
	"audio_id" uuid,
	"audio_duration_ms" integer,
	"audio_updated_at" timestamp with time zone,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "entries_profile_id_date_pk" PRIMARY KEY("profile_id","date"),
	CONSTRAINT "value_bounds" CHECK ("entries"."value" BETWEEN 1 AND 10),
	CONSTRAINT "note_length" CHECK (length("entries"."note") <= 2000),
	CONSTRAINT "audio_duration_bounds" CHECK ("entries"."audio_duration_ms" BETWEEN 1 AND 300000),
	CONSTRAINT "audio_pair" CHECK (("entries"."audio_id" IS NULL) = ("entries"."audio_duration_ms" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_hash" text NOT NULL,
	"audio_namespace" text NOT NULL,
	"seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone,
	CONSTRAINT "profiles_audio_namespace_unique" UNIQUE("audio_namespace")
);
--> statement-breakpoint
CREATE TABLE "replacement_receipts" (
	"old_id_hash" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"sealed_identity" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "replacement_receipts_old_id_hash_operation_id_pk" PRIMARY KEY("old_id_hash","operation_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_time" text DEFAULT '20:00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_time_format" CHECK ("settings"."reminder_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "entries_profile_seq" ON "entries" USING btree ("profile_id","server_seq");--> statement-breakpoint
CREATE INDEX "session_expiration" ON "sessions" USING btree ("expires_at");
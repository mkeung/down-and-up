CREATE TABLE "clamped_writes" (
	"profile_id" text NOT NULL,
	"date" date NOT NULL,
	"field" text NOT NULL,
	"client_timestamp" bigint NOT NULL,
	CONSTRAINT "clamped_writes_profile_id_date_field_client_timestamp_pk" PRIMARY KEY("profile_id","date","field","client_timestamp")
);
--> statement-breakpoint
ALTER TABLE "clamped_writes" ADD CONSTRAINT "clamped_writes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;
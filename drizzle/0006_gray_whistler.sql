CREATE TYPE "join_request_status" AS ENUM ('pending', 'accepted', 'declined');
CREATE TABLE "class_join_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "class_join_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"class_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "class_join_request_unique" UNIQUE("class_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"key" text NOT NULL,
	"reference_id" text NOT NULL,
	"prefix" text,
	"permissions" text,
	"request_count" integer DEFAULT 0 NOT NULL,
	"config_id" text,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_max" integer,
	"rate_limit_time_window" integer,
	"last_request" timestamp,
	"remaining" integer,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"metadata" text,
	"enabled" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "class_join_requests" ADD CONSTRAINT "class_join_requests_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_join_requests" ADD CONSTRAINT "class_join_requests_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_reference_id_user_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_join_requests_class_id_idx" ON "class_join_requests" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "class_join_requests_student_id_idx" ON "class_join_requests" USING btree ("student_id");

-- Migration: Add organization plugin tables
-- Created by: auth generate

-- Create organization table
CREATE TABLE "organization" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL UNIQUE,
    "logo" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "metadata" text
);

CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization"("slug");

-- Create member table
CREATE TABLE "member" (
    "id" text PRIMARY KEY NOT NULL,
    "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "role" text DEFAULT 'member' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "member_organizationId_idx" ON "member"("organization_id");
CREATE INDEX "member_userId_idx" ON "member"("user_id");

-- Create invitation table
CREATE TABLE "invitation" (
    "id" text PRIMARY KEY NOT NULL,
    "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
    "email" text NOT NULL,
    "role" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organization_id");
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- Add active_organization_id to session table (if not exists)
ALTER TABLE "session" ADD COLUMN "active_organization_id" text;

ALTER TABLE "birthdays" RENAME TO "contacts";--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "birth_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "email" varchar(255);

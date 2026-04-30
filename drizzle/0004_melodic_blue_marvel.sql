CREATE INDEX "apply_positions_division_id_idx" ON "apply_positions" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "apply_positions_is_deleted_idx" ON "apply_positions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "apply_positions_status_idx" ON "apply_positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "divisions_dept_id_idx" ON "divisions" USING btree ("dept_id");--> statement-breakpoint
CREATE INDEX "divisions_closed_at_idx" ON "divisions" USING btree ("closed_at");--> statement-breakpoint
CREATE INDEX "users_member_idx" ON "users" USING btree ("member");

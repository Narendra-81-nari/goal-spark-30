import { z } from "zod";

export const CYCLES = ["Q1", "Q2", "Q3", "Q4"] as const;
export const UOMS = ["HIGHER_BETTER", "LOWER_BETTER", "TIMELINE", "ZERO_BASED"] as const;

export const goalSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  target: z.coerce.number().min(0),
  weightage: z.coerce.number().min(10, "Each goal needs at least 10% weightage").max(100),
  uom: z.enum(UOMS),
  cycle: z.enum(CYCLES),
  deadline: z.string().optional().nullable(),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const checkinSchema = z.object({
  goal_id: z.string().uuid(),
  achievement_value: z.coerce.number().min(0),
  completion_date: z.string().optional().nullable(),
});
export type CheckinInput = z.infer<typeof checkinSchema>;

export const MAX_GOALS_PER_EMPLOYEE = 8;
export const REQUIRED_TOTAL_WEIGHTAGE = 100;

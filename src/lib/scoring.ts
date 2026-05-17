/**
 * UoM Scoring Engine — runs server-side prior to DB insert.
 * All scores are capped at 100% to keep dashboards sane.
 */
export type UoM = "HIGHER_BETTER" | "LOWER_BETTER" | "TIMELINE" | "ZERO_BASED";

export function computeScore(args: {
  uom: UoM;
  target: number;
  achievement: number;
  deadline?: string | null;
  completionDate?: string | null;
}): number {
  const { uom, target, achievement, deadline, completionDate } = args;

  switch (uom) {
    case "HIGHER_BETTER": {
      if (target <= 0) return 0;
      return Math.min(100, Math.max(0, (achievement / target) * 100));
    }
    case "LOWER_BETTER": {
      if (achievement <= 0) return 100;
      return Math.min(100, Math.max(0, (target / achievement) * 100));
    }
    case "ZERO_BASED": {
      return achievement === 0 ? 100 : 0;
    }
    case "TIMELINE": {
      if (!deadline || !completionDate) return 0;
      const dl = new Date(deadline).getTime();
      const cd = new Date(completionDate).getTime();
      return cd <= dl ? 100 : 0;
    }
  }
}

export function weightedScore(score: number, weightage: number): number {
  return (score * weightage) / 100;
}

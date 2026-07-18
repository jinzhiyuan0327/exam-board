import type { ExamItem } from '../types';
import { parseZonedTime } from './timeSource';

/** 考试时间线以开考时刻为唯一主顺序；手动 order 仅用于同一开考时刻的次级排序。 */
export function sortExamItemsByTime<T extends ExamItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = parseZonedTime(a.startTime);
    const bTime = parseZonedTime(b.startTime);
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return a.order - b.order;
  });
}

export function canReorderTogether(a: ExamItem | undefined, b: ExamItem | undefined): boolean {
  return !!a && !!b && a.startTime === b.startTime;
}

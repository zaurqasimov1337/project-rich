import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { DATE_RANGE_PRESETS, MAX_PAGE_SIZE } from '@edusphere/shared';

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = 20;

  /** field:asc|desc */
  @IsOptional()
  @Matches(/^[a-zA-Z_.]+:(asc|desc)$/)
  sort?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(DATE_RANGE_PRESETS as unknown as string[])
  range?: string;

  @IsOptional()
  @IsString()
  from?: string; // ISO date

  @IsOptional()
  @IsString()
  to?: string; // ISO date

  /** Export format on report/export endpoints (xlsx|csv). Ignored elsewhere. */
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  branchId?: string[];

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  status?: string[];

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  orderBy(defaultField = 'createdAt', allowed: string[] = []): Record<string, 'asc' | 'desc'> {
    if (this.sort) {
      const [field, dir] = this.sort.split(':') as [string, 'asc' | 'desc'];
      if (allowed.length === 0 || allowed.includes(field)) return { [field]: dir };
    }
    return { [defaultField]: 'desc' };
  }
}

export function paginated<T>(data: T[], total: number, q: ListQueryDto) {
  return { data, meta: { page: q.page, limit: q.limit, total } };
}

/** Resolves range preset or from/to into a UTC [gte, lt) window (tenant TZ = Asia/Baku, UTC+4). */
export function resolveDateRange(
  q: Pick<ListQueryDto, 'range' | 'from' | 'to'>,
  tzOffsetHours = 4,
): { gte: Date; lt: Date } | undefined {
  const offsetMs = tzOffsetHours * 3600 * 1000;
  const nowLocal = new Date(Date.now() + offsetMs);
  const d = (y: number, m: number, day: number) =>
    new Date(Date.UTC(y, m, day) - offsetMs);
  const y = nowLocal.getUTCFullYear();
  const m = nowLocal.getUTCMonth();
  const day = nowLocal.getUTCDate();
  const dow = (nowLocal.getUTCDay() + 6) % 7; // Monday=0

  switch (q.range) {
    case 'today':
      return { gte: d(y, m, day), lt: d(y, m, day + 1) };
    case 'yesterday':
      return { gte: d(y, m, day - 1), lt: d(y, m, day) };
    case 'this_week':
      return { gte: d(y, m, day - dow), lt: d(y, m, day - dow + 7) };
    case 'last_week':
      return { gte: d(y, m, day - dow - 7), lt: d(y, m, day - dow) };
    case 'this_month':
      return { gte: d(y, m, 1), lt: d(y, m + 1, 1) };
    case 'last_month':
      return { gte: d(y, m - 1, 1), lt: d(y, m, 1) };
    case 'this_quarter': {
      const qm = Math.floor(m / 3) * 3;
      return { gte: d(y, qm, 1), lt: d(y, qm + 3, 1) };
    }
    case 'last_quarter': {
      const qm = Math.floor(m / 3) * 3;
      return { gte: d(y, qm - 3, 1), lt: d(y, qm, 1) };
    }
    case 'this_year':
      return { gte: d(y, 0, 1), lt: d(y + 1, 0, 1) };
    case 'last_year':
      return { gte: d(y - 1, 0, 1), lt: d(y, 0, 1) };
  }
  if (q.from || q.to) {
    return {
      gte: q.from ? new Date(q.from) : new Date(0),
      lt: q.to ? new Date(new Date(q.to).getTime() + 24 * 3600 * 1000) : new Date('2100-01-01'),
    };
  }
  return undefined;
}

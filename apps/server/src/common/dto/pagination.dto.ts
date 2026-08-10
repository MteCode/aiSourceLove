import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { PageResult } from '@yuanqiao/shared';

export class PaginationDto {
  @ApiPropertyOptional({ description: '页码，从 1 开始', default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value as string, 10) || 1)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value as string, 10) || 20)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ description: '排序字段' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}

export function buildPageResult<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
): PageResult<T> {
  return {
    list,
    total,
    page,
    pageSize,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

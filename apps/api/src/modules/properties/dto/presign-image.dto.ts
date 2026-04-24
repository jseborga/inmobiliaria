import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, Max } from 'class-validator';

export class PresignImageDto {
  @IsString()
  @MaxLength(80)
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  contentLength!: number;
}

export class ConfirmImageDto {
  @IsString()
  @MaxLength(250)
  r2Key!: string;

  @IsString()
  @MaxLength(500)
  publicUrl!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  order?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  width?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  height?: number;
}

import {
  JOB_CONTRACTS,
  JOB_LOCATIONS,
  JobFeedQuery,
} from '@devstart/shared-types';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const LOCATION_IDS = JOB_LOCATIONS.map((l) => l.id);
const CONTRACT_IDS = JOB_CONTRACTS.map((c) => c.id);

/** "4,18" (query string) ou [4, 18] (JSON) → [4, 18]. */
const toIntList = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const list = Array.isArray(value) ? value : String(value).split(',');
    return list.map((v) => Number(v));
  });

/** "true"/"1" (query string) ou true (JSON) → true. */
const toBool = () =>
  Transform(({ value }) =>
    value === undefined
      ? undefined
      : value === true || value === 'true' || value === '1',
  );

/** Filtros da secção de vagas, na query string do GET ou no corpo do PUT da visita. */
export class JobFeedQueryDto implements JobFeedQuery {
  @IsOptional()
  @toIntList()
  @ArrayMaxSize(LOCATION_IDS.length)
  @IsInt({ each: true })
  @IsIn(LOCATION_IDS, { each: true, message: 'Localização desconhecida.' })
  locations?: number[];

  @IsOptional()
  @toBool()
  @IsBoolean()
  remote?: boolean;

  @IsOptional()
  @toIntList()
  @ArrayMaxSize(CONTRACT_IDS.length)
  @IsInt({ each: true })
  @IsIn(CONTRACT_IDS, { each: true, message: 'Tipo de contrato desconhecido.' })
  contracts?: number[];

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,64}$/, { message: 'Stack inválida.' })
  stackId?: string;

  @IsOptional()
  @toBool()
  @IsBoolean()
  includeUnrealistic?: boolean;
}

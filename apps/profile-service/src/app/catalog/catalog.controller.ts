import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  CompetencyCategory,
  UserCompetencyLevel,
} from '@devstart/shared-types';
import { CatalogService } from './catalog.service';

/**
 * O catálogo muda só quando há um deploy: o browser pode guardá-lo 5 minutos
 * e depois revalidar com o ETag (que o Express gera a partir do corpo). Sem
 * alterações, a resposta é um 304 vazio em vez da lista inteira.
 */
const CATALOG_CACHE = 'public, max-age=300, stale-while-revalidate=3600';

interface PreviewGapBody {
  stackId: string;
  competencies: UserCompetencyLevel[];
  competenciesWithProjects?: string[];
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('competencies')
  @Header('Cache-Control', CATALOG_CACHE)
  findCompetencies(
    @Query('category') category?: CompetencyCategory,
    @Query('q') q?: string,
  ) {
    return this.catalog.findCompetencies({ category, q });
  }

  @Get('competencies/:id')
  @Header('Cache-Control', CATALOG_CACHE)
  findCompetency(@Param('id') id: string) {
    return this.catalog.findCompetency(id);
  }

  @Get('stacks')
  @Header('Cache-Control', CATALOG_CACHE)
  findStacks() {
    return this.catalog.findStacks();
  }

  @Get('stacks/:id')
  @Header('Cache-Control', CATALOG_CACHE)
  findStack(@Param('id') id: string) {
    return this.catalog.findStack(id);
  }

  @Post('skill-gap/preview')
  previewGap(@Body() body: PreviewGapBody) {
    return this.catalog.previewGap(
      body.stackId,
      body.competencies ?? [],
      body.competenciesWithProjects,
    );
  }
}

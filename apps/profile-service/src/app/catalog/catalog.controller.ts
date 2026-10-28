import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  CompetencyCategory,
  UserCompetencyLevel,
} from '@devstart/shared-types';
import { CatalogService } from './catalog.service';

interface PreviewGapBody {
  stackId: string;
  competencies: UserCompetencyLevel[];
  competenciesWithProjects?: string[];
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('competencies')
  findCompetencies(
    @Query('category') category?: CompetencyCategory,
    @Query('q') q?: string,
  ) {
    return this.catalog.findCompetencies({ category, q });
  }

  @Get('competencies/:id')
  findCompetency(@Param('id') id: string) {
    return this.catalog.findCompetency(id);
  }

  @Get('stacks')
  findStacks() {
    return this.catalog.findStacks();
  }

  @Get('stacks/:id')
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

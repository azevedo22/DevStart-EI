import {
  APPLICATION_LIMITS,
  Interview,
  SaveInterviewRequest,
} from '@devstart/shared-types';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewEntity } from '../applications/application.entities';
import {
  ApplicationsService,
  toInterview,
} from '../applications/applications.service';
import { SaveInterviewDto } from './dto/interview.dto';

const NOT_FOUND = 'Entrevista não encontrada.';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(InterviewEntity)
    private readonly interviews: Repository<InterviewEntity>,
    private readonly applications: ApplicationsService,
  ) {}

  async create(
    userId: string,
    applicationId: string,
    dto: SaveInterviewDto,
  ): Promise<Interview> {
    await this.applications.findOwned(userId, applicationId); // 404 se não for do utilizador
    if (
      (await this.interviews.countBy({ applicationId })) >=
      APPLICATION_LIMITS.interviewsPerApplication
    ) {
      throw new ConflictException(
        `No máximo ${APPLICATION_LIMITS.interviewsPerApplication} entrevistas por candidatura.`,
      );
    }
    const saved = await this.interviews.save(
      this.interviews.create({ applicationId, ...toInterviewFields(dto) }),
    );
    return toInterview(saved);
  }

  async update(
    userId: string,
    id: string,
    dto: SaveInterviewDto,
  ): Promise<Interview> {
    const interview = await this.findOwned(userId, id);
    Object.assign(interview, toInterviewFields(dto));
    return toInterview(await this.interviews.save(interview));
  }

  async remove(userId: string, id: string): Promise<void> {
    const interview = await this.findOwned(userId, id);
    await this.interviews.delete({ id: interview.id });
  }

  /** A entrevista é de quem é dono da candidatura: verifica-se pelo join. */
  private async findOwned(
    userId: string,
    id: string,
  ): Promise<InterviewEntity> {
    const interview = await this.interviews
      .createQueryBuilder('i')
      .innerJoin('i.application', 'a')
      .where('i.id = :id AND a.user_id = :userId', { id, userId })
      .getOne();
    if (!interview) throw new NotFoundException(NOT_FOUND);
    return interview;
  }
}

/** Campos de uma entrevista a partir do pedido. Exportado para os dados de demonstração. */
export function toInterviewFields(
  dto: SaveInterviewRequest,
): Partial<InterviewEntity> {
  return {
    type: dto.type,
    scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
    completed: dto.completed,
    // Só faz sentido avaliar uma entrevista que já aconteceu.
    rating: dto.completed ? (dto.rating ?? null) : null,
    outcome: dto.outcome,
    questionsAsked: dto.questionsAsked,
    strengths: dto.strengths ?? null,
    improvements: dto.improvements ?? null,
  };
}

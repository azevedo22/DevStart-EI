import {
  DomainEvent,
  EventHandlers,
  EventSubscriber,
} from '@devstart/backend-common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Env } from '../config/env';
import { DemoProfileSeeder } from '../demo/demo-profile.seeder';

/**
 * Ouve eventos sobre utilizadores publicados pelo Auth Service.
 * user.deleted      → apaga perfil, competências declaradas e projetos.
 * user.demo-created → preenche a conta de demonstração com o perfil de exemplo.
 */
@Injectable()
export class UserEventsSubscriber extends EventSubscriber {
  protected readonly group = 'profile-service';
  private readonly log = new Logger(UserEventsSubscriber.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly demo: DemoProfileSeeder,
  ) {
    super();
  }

  protected redisUrl(): string | null {
    return this.config.get('REDIS_URL', { infer: true }) || null;
  }

  protected handlers(): EventHandlers {
    return {
      'user.deleted': (e) => this.onUserDeleted(e),
      'user.demo-created': (e) => this.demo.seed(e.payload.userId),
    };
  }

  /**
   * Idempotente: se o evento chegar duas vezes (entrega "pelo menos uma vez"),
   * a segunda não encontra nada para apagar e termina sem erro.
   */
  async onUserDeleted(event: DomainEvent<'user.deleted'>): Promise<void> {
    const { userId } = event.payload;
    const removed = await this.db.transaction(async (em) => {
      // project_competencies sai em cascata com os projetos.
      const projects = await em.query(
        `DELETE FROM projects WHERE user_id = $1`,
        [userId],
      );
      const competencies = await em.query(
        `DELETE FROM profile_competencies WHERE user_id = $1`,
        [userId],
      );
      const profiles = await em.query(
        `DELETE FROM profiles WHERE user_id = $1`,
        [userId],
      );
      // Formação, experiência e línguas: sem contagem no log, só se apagam.
      for (const table of [
        'profile_education',
        'profile_experience',
        'profile_languages',
      ]) {
        await em.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      }
      return {
        projects: projects[1],
        competencies: competencies[1],
        profiles: profiles[1],
      };
    });
    this.log.log(
      `user.deleted ${userId}: ${removed.projects} projetos, ${removed.competencies} competências, ${removed.profiles} perfil apagados.`,
    );
  }
}

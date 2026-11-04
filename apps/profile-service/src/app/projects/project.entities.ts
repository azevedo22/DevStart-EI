import type {
  EntrySource,
  IndustryPractice,
  ProjectOrigin,
} from '@devstart/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'projects' })
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'varchar', length: 2000 })
  description!: string;

  @Column({
    name: 'repository_url',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  repositoryUrl!: string | null;

  @Column({ name: 'live_url', type: 'varchar', length: 300, nullable: true })
  liveUrl!: string | null;

  @Column({ type: 'varchar', length: 16 })
  origin!: ProjectOrigin;

  @Column({
    name: 'academic_context',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  academicContext!: string | null;

  /** Lista pequena e fechada (5 valores): um array chega, sem tabela própria. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  practices!: IndustryPractice[];

  /**
   * Competências que o projeto demonstra, numa tabela de ligação.
   * Permite perguntar "que projetos demonstram Docker?" com um índice, sem varrer arrays.
   */
  @OneToMany(() => ProjectCompetencyEntity, (pc) => pc.project, {
    cascade: true,
    eager: true,
  })
  competencies!: ProjectCompetencyEntity[];

  /** 'cv' se veio de uma importação do CV e ainda não foi editada. */
  @Column({ type: 'varchar', length: 8, default: 'manual' })
  source!: EntrySource;

  /** Entrou por uma importação do CV (não muda ao editar): a criação não conta como atividade. */
  @Column({ type: 'boolean', default: false })
  imported!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'project_competencies' })
export class ProjectCompetencyEntity {
  @PrimaryColumn({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @PrimaryColumn({ name: 'competency_id', type: 'varchar', length: 64 })
  competencyId!: string;

  @ManyToOne(() => ProjectEntity, (p) => p.competencies, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'project_id' })
  project?: ProjectEntity;
}

import type {
  Accessibility,
  ApplicationStatus,
  InterviewOutcome,
  InterviewType,
  Seniority,
  WorkMode,
} from '@devstart/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'applications' })
export class ApplicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'company_name', type: 'varchar', length: 120 })
  companyName!: string;

  @Column({ name: 'job_title', type: 'varchar', length: 150 })
  jobTitle!: string;

  @Column({ name: 'job_url', type: 'varchar', length: 500, nullable: true })
  jobUrl!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location!: string | null;

  @Column({ name: 'work_mode', type: 'varchar', length: 16 })
  workMode!: WorkMode;

  @Column({ type: 'varchar', length: 24 })
  status!: ApplicationStatus;

  /** Ordem dentro da coluna do Kanban: 0 é o topo, sem buracos. */
  @Column({ type: 'int' })
  position!: number;

  /**
   * Ids do catálogo do Profile Service. Array em vez de tabela: aqui só se leem
   * em conjunto com a candidatura, nunca se pesquisa por competência.
   */
  @Column({
    name: 'required_competency_ids',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  requiredCompetencyIds!: string[];

  @Column({ name: 'years_required', type: 'smallint', nullable: true })
  yearsRequired!: number | null;

  @Column({ type: 'varchar', length: 16 })
  seniority!: Seniority;

  /** Derivada de yearsRequired + seniority pelo servidor; guardada para filtrar e agregar. */
  @Column({ type: 'varchar', length: 16 })
  accessibility!: Accessibility;

  @Column({ name: 'mislabeled_junior', type: 'boolean', default: false })
  mislabeledJunior!: boolean;

  @Column({ name: 'applied_at', type: 'date' })
  appliedAt!: string;

  @Column({ type: 'varchar', length: 4000, nullable: true })
  notes!: string | null;

  @OneToMany(() => InterviewEntity, (i) => i.application)
  interviews?: InterviewEntity[];

  /** Preenchido nas listagens com uma subconsulta de contagem (não é uma coluna). */
  interviewCount?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** Cada mudança de coluna fica registada: dá a linha temporal e as estatísticas. */
@Entity({ name: 'application_status_history' })
export class StatusHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @ManyToOne(() => ApplicationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: ApplicationEntity;

  @Column({ name: 'from_status', type: 'varchar', length: 24, nullable: true })
  fromStatus!: ApplicationStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 24 })
  toStatus!: ApplicationStatus;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  changedAt!: Date;
}

@Entity({ name: 'interviews' })
export class InterviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @ManyToOne(() => ApplicationEntity, (a) => a.interviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'application_id' })
  application?: ApplicationEntity;

  @Column({ type: 'varchar', length: 16 })
  type!: InterviewType;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  completed!: boolean;

  @Column({ type: 'smallint', nullable: true })
  rating!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  outcome!: InterviewOutcome;

  @Column({
    name: 'questions_asked',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  questionsAsked!: string[];

  @Column({ type: 'varchar', length: 2000, nullable: true })
  strengths!: string | null;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  improvements!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

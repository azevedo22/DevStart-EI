import type {
  EntrySource,
  ExperienceKind,
  LanguageLevel,
} from '@devstart/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'profile_education' })
export class EducationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 160 })
  institution!: string;

  @Column({ type: 'varchar', length: 160 })
  degree!: string;

  @Column({
    name: 'field_of_study',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  fieldOfStudy!: string | null;

  @Column({ name: 'start_year', type: 'smallint', nullable: true })
  startYear!: number | null;

  @Column({ name: 'end_year', type: 'smallint', nullable: true })
  endYear!: number | null;

  /** 'cv' se veio de uma importação do CV e ainda não foi editada. */
  @Column({ type: 'varchar', length: 8, default: 'manual' })
  source!: EntrySource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'profile_experience' })
export class ExperienceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 160 })
  organization!: string;

  @Column({ type: 'varchar', length: 120 })
  role!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: ExperienceKind;

  @Column({ name: 'start_date', type: 'varchar', length: 7, nullable: true })
  startDate!: string | null;

  @Column({ name: 'end_date', type: 'varchar', length: 7, nullable: true })
  endDate!: string | null;

  @Column({ type: 'varchar', length: 1500, nullable: true })
  description!: string | null;

  /** 'cv' se veio de uma importação do CV e ainda não foi editada. */
  @Column({ type: 'varchar', length: 8, default: 'manual' })
  source!: EntrySource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'profile_languages' })
export class LanguageEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  language!: string;

  @Column({ type: 'varchar', length: 8 })
  level!: LanguageLevel;

  /** Ordem em que o utilizador as indicou (normalmente a materna primeiro). */
  @Column({ type: 'smallint', default: 0 })
  position!: number;
}

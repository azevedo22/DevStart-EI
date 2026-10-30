import type { Level } from '@devstart/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Dados de apresentação do perfil. A chave é o id do utilizador do Auth Service:
 * é uma referência lógica, sem chave estrangeira, porque cada serviço tem a sua base de dados.
 */
@Entity({ name: 'profiles' })
export class ProfileEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  headline!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  university!: string | null;

  @Column({ name: 'graduation_year', type: 'smallint', nullable: true })
  graduationYear!: number | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location!: string | null;

  @Column({
    name: 'linkedin_url',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  linkedinUrl!: string | null;

  @Column({ name: 'github_url', type: 'varchar', length: 300, nullable: true })
  githubUrl!: string | null;

  @Column({
    name: 'portfolio_url',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  portfolioUrl!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** Uma competência declarada. A chave composta impede declarar a mesma competência duas vezes. */
@Entity({ name: 'profile_competencies' })
export class ProfileCompetencyEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'competency_id', type: 'varchar', length: 64 })
  competencyId!: string;

  @Column({ type: 'varchar', length: 16 })
  level!: Level;

  @CreateDateColumn({ name: 'declared_at', type: 'timestamptz' })
  declaredAt!: Date;
}

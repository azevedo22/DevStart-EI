import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foto de perfil, numa tabela à parte: o perfil é lido a toda a hora e não
 * deve arrastar uma imagem consigo. Uma foto por utilizador.
 */
export class AddProfilePhoto1730230000000 implements MigrationInterface {
  name = 'AddProfilePhoto1730230000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "profile_photos" (
        "user_id"     uuid        PRIMARY KEY,
        "content"     bytea       NOT NULL,
        "mime_type"   varchar(16) NOT NULL,
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_profile_photos_mime" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
        CONSTRAINT "ck_profile_photos_size" CHECK (octet_length("content") <= 1048576)
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "profile_photos"`);
  }
}

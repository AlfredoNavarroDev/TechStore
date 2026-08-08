import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foundational (T012): extensión pg_trgm, tipos enum base, tablas user/refresh_token/
 * pickup_location/audit_log, función set_updated_at() + su trigger en user, e índices
 * (data-model.md §Índices). El resto de tablas/triggers/views llegan en migraciones de
 * cada user story (T032, T047-T050, T086-T087, T095-T096 — ver nota en tasks.md).
 */
export class Foundational1738800000000 implements MigrationInterface {
  name = 'Foundational1738800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Búsqueda de texto en catálogo (FR-003, US1) — se declara acá porque debe existir
    // antes de cualquier índice GIN que dependa de ella (plan.md, nota pg_trgm).
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`); // gen_random_uuid()

    await queryRunner.query(`
      CREATE TYPE "role" AS ENUM ('USER', 'ADMIN', 'INVENTORY_MANAGER', 'DELIVERY');
    `);
    await queryRunner.query(`
      CREATE TYPE "audit_operation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
    `);

    await queryRunner.query(`
      CREATE TABLE "user" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL,
        password_hash varchar(255) NULL,
        name varchar(255) NOT NULL,
        role "role" NOT NULL DEFAULT 'USER',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_email" UNIQUE (email)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE refresh_token (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        token_hash varchar(255) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_refresh_token_hash ON refresh_token (token_hash);`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_refresh_token_user ON refresh_token (user_id);`,
    );

    await queryRunner.query(`
      CREATE TABLE pickup_location (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        address varchar(500) NOT NULL,
        active boolean NOT NULL DEFAULT true
      );
    `);

    await queryRunner.query(`
      CREATE TABLE audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        entity_type varchar(50) NOT NULL,
        entity_id uuid NOT NULL,
        operation "audit_operation" NOT NULL,
        metadata jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id, created_at DESC);`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audit_log_actor ON audit_log (actor_user_id, created_at DESC);`,
    );

    // trg_set_updated_at (data-model.md §Triggers) — se crea acá porque "user" ya existe;
    // los triggers en product/order se agregan en las migraciones de US1/US2.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_user_updated_at
        BEFORE UPDATE ON "user"
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_user_updated_at ON "user";`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at();`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS pickup_location;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_token;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_operation";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role";`);
  }
}

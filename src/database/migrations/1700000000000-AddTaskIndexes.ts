import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddTaskIndexes1700000000000 implements MigrationInterface {
  name = 'AddTaskIndexes1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Composite index for common filtering combinations
    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_TASKS_STATUS_PRIORITY',
        columnNames: ['status', 'priority'],
      })
    );

    // Index for user filtering
    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_TASKS_USER_ID',
        columnNames: ['user_id'],
      })
    );

    // Index for due date filtering
    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_TASKS_DUE_DATE',
        columnNames: ['due_date'],
      })
    );

    // Composite index for status and due date (for overdue queries)
    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_TASKS_STATUS_DUE_DATE',
        columnNames: ['status', 'due_date'],
      })
    );

    // Index for created_at (for sorting)
    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_TASKS_CREATED_AT',
        columnNames: ['created_at'],
      })
    );

    // Full-text search index for title and description
    await queryRunner.query(`
      CREATE INDEX IDX_TASKS_SEARCH 
      ON tasks 
      USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_TASKS_SEARCH`);
    await queryRunner.dropIndex('tasks', 'IDX_TASKS_CREATED_AT');
    await queryRunner.dropIndex('tasks', 'IDX_TASKS_STATUS_DUE_DATE');
    await queryRunner.dropIndex('tasks', 'IDX_TASKS_DUE_DATE');
    await queryRunner.dropIndex('tasks', 'IDX_TASKS_USER_ID');
    await queryRunner.dropIndex('tasks', 'IDX_TASKS_STATUS_PRIORITY');
  }
}

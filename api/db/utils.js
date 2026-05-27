export async function addMissingColumns(queryInterface, tableName, table, columns) {
  for (const [column, definition] of Object.entries(columns)) {
    if (!table[column]) await queryInterface.addColumn(tableName, column, definition);
  }
}

export async function removeExistingColumns(queryInterface, tableName, table, columns) {
  for (const column of columns) {
    if (table[column]) await queryInterface.removeColumn(tableName, column);
  }
}

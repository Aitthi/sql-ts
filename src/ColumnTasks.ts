import { ColumnDefinition, TableDefinition } from './Adapters/AdapterInterface'
import * as AdapterFactory from './AdapterFactory'
import { Knex } from 'knex'
import { Column, Config } from './Typings'
import * as SharedTasks from './SharedTasks'
import TypeMap from './TypeMap'

/**
 * Returns all columns in a given Table using a knex context.
 * 
 * @export
 * @param {knex} db The knex config to use.
 * @param {TableDefinition} table The table to return columns for..
 * @param {Config} config The configuration to use.
 * @returns {Promise<Column[]>} 
 */
export async function getColumnsForTable (db: Knex, table: TableDefinition, config: Config): Promise<Column[]> {
  const adapter = AdapterFactory.buildAdapter(config)
  const columns = await adapter.getAllColumns(db, config, table.name, table.schema)
  return columns.map(c => (
    {
      ...c,
      propertyName: SharedTasks.convertCase(c.name.replace(/ /g,''), config.columnNameCasing),
      propertyType: convertType(c, table, config),
    } as Column))
}

/**
 * Generates the full column name comprised of the table, schema and column.
 * 
 * @export
 * @param {string} tableName The name of the table that contains the column.
 * @param {string} schemaName The name of the schema that contains the table.
 * @param {string} columnName The name of the column.
 * @returns {string} The full table name.
 */
export function generateFullColumnName (tableName: string, schemaName: string, columnName: string): string {
  let result = tableName
  if  (schemaName != null && schemaName !== '') {
    result = `${schemaName}.` + result
  }
  result += `.${columnName}`
  return result
}

/**
 * Converts a database type to that of a JavaScript type.
 * 
 * @export
 * @param {Column} column The column definition to convert.
 * @param {Table} table The table that the column belongs to.
 * @param {Config} config The configuration object.
 * @returns {string}
 */
 export function convertType (column: ColumnDefinition, table: TableDefinition, config: Config): string {
  if (column.isEnum) {
    return column.type.replace(/ /g, '')
  }
  const fullname = generateFullColumnName(table.name, table.schema, column.name)
  
  let convertedType = null
  const overrides = config.typeOverrides
  const userTypeMap = config.typeMap
  
  // Start with user config overrides.
  convertedType = overrides[fullname]
  // Then check the user config typemap.
  if (convertedType == null) {
    convertedType = Object.keys(userTypeMap).find(t => userTypeMap[t].includes(column.type))
  }

  // Then the schema specific typemap.
  if (convertedType == null) {
    const adapterName = SharedTasks.resolveAdapterName(config)
    const perDBTypeMap = TypeMap[adapterName]
    if (perDBTypeMap != null) {
      convertedType = Object.keys(perDBTypeMap).find(f => perDBTypeMap[f].includes(column.type))
    }
  }
  
  // Then the global type map.
  if (convertedType == null) {
    let globalMap = TypeMap['global']
    convertedType = Object.keys(globalMap).find(f => globalMap[f].includes(column.type))
  }

  // Finally just any type.
  return convertedType == null ? 'any' : convertedType
}
import 'jasmine'
import * as ColumnTasks from '../ColumnTasks'
import { Column, Config } from '../Typings'
import { ColumnDefinition } from '../Adapters/AdapterInterface'
const rewire = require('rewire')

let RewireColumnTasks = rewire('../ColumnTasks')
const MockColumnTasks: typeof ColumnTasks & typeof RewireColumnTasks = <any> RewireColumnTasks

describe('ColumnTasks', () => {
  describe('getColumnsForTable', () => {
    it('should return all columns for a table', (done) => {
      const mockColumns: ColumnDefinition[] = [
        {
          nullable: false,
          name: 'cname',
          type: 'ctype',
          optional: false,
          isEnum: false,
          isPrimaryKey: true
        }
      ]
      const mockAdapter = {
        getAllColumns: jasmine.createSpy('getAllColumns').and.returnValue(mockColumns)
      }
      const mockAdapterFactory = {
        buildAdapter: jasmine.createSpy('buildAdapter').and.returnValue(mockAdapter)
      }
      const mockSharedTasks = {
        convertCase: jasmine.createSpy('convertCase').and.returnValue('newname'),
      }
      const mockConvertType = jasmine.createSpy('convertType').and.returnValue('newType')
      MockColumnTasks.__with__({
        AdapterFactory: mockAdapterFactory,
        SharedTasks: mockSharedTasks,
        convertType: mockConvertType
      })(async () => {
        const db = {}
        const table = {
          name: 'name',
          schema: 'schema'
        }
        const config: Config = {
          dialect: 'dialect',
          columnNameCasing: 'camel'
        }
        const result = await MockColumnTasks.getColumnsForTable(db as any, table as any, config as any)
        expect(mockAdapterFactory.buildAdapter).toHaveBeenCalledWith(config)
        expect(mockAdapter.getAllColumns).toHaveBeenCalledWith(db, config, 'name', 'schema')
        expect(mockSharedTasks.convertCase).toHaveBeenCalledWith('cname', 'camel')
        expect(mockConvertType).toHaveBeenCalledWith(mockColumns[0], table, config)
        expect(result).toEqual([
          {
            nullable: false,
            name: 'cname',
            propertyName: 'newname',
            propertyType: 'newType',
            type: 'ctype',
            optional: false,
            isEnum: false,
            isPrimaryKey: true
          } as Column
        ])
        done()
      })
    })
  })
  describe('generateFullColumnName', () => {
    it('should generate a name with a schema', () => {
      const result = MockColumnTasks.generateFullColumnName('table', 'schema', 'column')
      expect(result).toBe('schema.table.column')
    })
    it('should skip schema if blank', () => {
      const result = MockColumnTasks.generateFullColumnName('table', '', 'column')
      expect(result).toBe('table.column')
    })
    it('should skip schema if null', () => {
      const result = MockColumnTasks.generateFullColumnName('table', null, 'column')
      expect(result).toBe('table.column')
    })
  })
  describe('convertType', () => {
    it('should use the built global types when no specific client exists', () => {
      const mockSharedTasks = {
        resolveAdapterName: jasmine.createSpy('resolveAdapterName').and.returnValue('adapterName')
      }
      const mockGenerateFullColumnName = jasmine.createSpy('generateFullColumnName').and.returnValue('fullcolumn')
      MockColumnTasks.__with__({
        TypeMap_1: {
          default: {
            global: {
              'globaltype': ['tofind']
            }
          }
        },
        SharedTasks: mockSharedTasks,
        generateFullColumnName: mockGenerateFullColumnName
      })(() => {
        const mockTable = {
          schema: 'schema',
          name: 'table'
        }
        const mockColumn = {
          isEnum: false,
          name: 'column',
          type: 'tofind'
        }
        const mockConfig: Config = {
          typeOverrides: { },
          typeMap: { }
        }
        const result = MockColumnTasks.convertType(mockColumn, mockTable, mockConfig)
        expect(mockGenerateFullColumnName).toHaveBeenCalledOnceWith('table', 'schema', 'column')
        expect(mockSharedTasks.resolveAdapterName).toHaveBeenCalledOnceWith(mockConfig)
        expect(result).toBe('globaltype')
      })
    })
    it('should use the built in types for a specific client', (done) => {
      const mockSharedTasks = {
        resolveAdapterName: jasmine.createSpy('resolveAdapterName').and.returnValue('adapterName')
      }
      const mockGenerateFullColumnName = jasmine.createSpy('generateFullColumnName').and.returnValue('fullcolumn')
      MockColumnTasks.__with__({
        TypeMap_1: {
          default: {
            adapterName: {
              'type': ['tofind']
            }
          }
        },
        SharedTasks: mockSharedTasks,
        generateFullColumnName: mockGenerateFullColumnName
      })(() => {
        const mockTable = {
          schema: 'schema',
          name: 'table'
        }
        const mockColumn = {
          isEnum: false,
          name: 'column',
          type: 'tofind'
        }
        const mockConfig: Config = {
          typeOverrides: { },
          typeMap: { }
        }
        const result = MockColumnTasks.convertType(mockColumn, mockTable, mockConfig)
        expect(mockSharedTasks.resolveAdapterName).toHaveBeenCalledOnceWith(mockConfig)
        expect(mockGenerateFullColumnName).toHaveBeenCalledOnceWith('table', 'schema', 'column')
        expect(result).toBe('type')
        done()
      })
    })
    it('should use the user type map if available', () => {
      const mockGenerateFullColumnName = jasmine.createSpy('generateFullColumnName').and.returnValue('fullcolumn')
      MockColumnTasks.__with__({
        generateFullColumnName: mockGenerateFullColumnName
      })(() => {
        const mockTable = {
          name: 'tableName',
          schema: 'schema'
        }
        const mockColumn = {
          name: 'tofind',
          type: 'ctype'
        }
        const mockConfig: Config = {
          typeMap: {
            type: ['ctype']
          },
          typeOverrides: { }
        }
        const result = MockColumnTasks.convertType(mockColumn, mockTable, mockConfig)
        expect(mockGenerateFullColumnName).toHaveBeenCalledOnceWith('tableName', 'schema', 'tofind')
        expect(result).toBe('type')
      })
    })
    it('should use the user type map even if available in the global map', () => {
      MockColumnTasks.__with__({
        TypeMap_1: {
          default: {
            'globaltype': ['ctype']
          }
        }
      })(() => {
        const mockTable = {
          name: 'tableName',
          schema: 'schema'
        }
        const mockColumn = {
          type: 'ctype'
        }
        const mockConfig: Config = {
          typeMap: {
            type: ['ctype']
          },
          typeOverrides: { }
        }
        const result = MockColumnTasks.convertType(mockColumn, mockTable, mockConfig)
        expect(result).toBe('type')
      })
    })
    it('should use a type override if available', () => {
      MockColumnTasks.__with__({
      })(() => {
        const mockTable = {
          name: 'tableName',
          schema: 'schema'
        }
        const mockColumn = {
          name: 'cname',
          type: 'ctype'
        }
        const mockConfig = {
          typeOverrides: {
            'schema.tableName.cname': 'type'
          }
        }
        const result = MockColumnTasks.convertType(mockColumn, mockTable, mockConfig)
        expect(result).toBe('type')
      })
    })
    it('should use the type override if available in the other maps', () => {
      MockColumnTasks.__with__({
        TypeMap_1: {
          default: {
            'globaltype': ['ctype']
          }
        }
      })(() => {
        const mockTable = {
          name: 'tableName',
          schema: 'schema'
        }
        const mockColumn = {
          name: 'column',
          type: 'ctype'
        }
        const mockConfig = {
          typeOverrides: { 'schema.tableName.column': 'overridetype' },
          typeMap: { usertype: ['ctype'] }
        }
        const result = MockColumnTasks.convertType(mockColumn, mockTable, mockConfig)
        expect(result).toBe('overridetype')
      })
    })
    it('should use any if no override exists', () => {
      const mockGenerateFullColumnName = jasmine.createSpy('generateFullColumnName').and.returnValue('fullcolumn')
      const mockSharedTasks = {
        resolveAdapterName: jasmine.createSpy('resolveAdapterName').and.returnValue('adapter')
      }
      const mockConfig: Config = {
        typeMap: { },
        typeOverrides: {
          'columnname1': 'type'
        }
      }
      MockColumnTasks.__with__({
        TypeMap_1: {
          default: {
            global: {
              'type': ['tofind1']
            }
          }
        },
        SharedTasks: mockSharedTasks,
        generateFullColumnName: mockGenerateFullColumnName
      })(() => {
        const mockTable = {
          name: 'table',
          schema: 'schema'
        }
        const mockColumn = {
          name: 'column'
        }
        const result = MockColumnTasks.convertType(mockColumn, mockTable, mockConfig)
        expect(mockGenerateFullColumnName).toHaveBeenCalledOnceWith('table', 'schema', 'column')
        expect(mockSharedTasks.resolveAdapterName).toHaveBeenCalledOnceWith(mockConfig)
        expect(result).toBe('any')
      })
    })
  })
})
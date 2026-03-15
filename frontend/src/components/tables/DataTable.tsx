'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string; header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}
interface PaginationMeta { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean; }
interface DataTableProps<T> {
  columns: Column<T>[]; data: T[]; meta?: PaginationMeta;
  onPageChange?: (page: number) => void; loading?: boolean;
  emptyMessage?: string; keyExtractor?: (row: T) => string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns, data, meta, onPageChange, loading, emptyMessage = 'No records found', keyExtractor,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th key={col.key} className={`table-header ${col.className || ''}`}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              Array.from({length:5}).map((_,i) => (
                <tr key={i}>{columns.map((col) => (
                  <td key={col.key} className="table-cell"><div className="h-4 bg-gray-100 rounded-lg animate-pulse"/></td>
                ))}</tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-14 text-gray-400 text-sm">{emptyMessage}</td></tr>
            ) : (
              data.map((row, i) => (
                <tr key={keyExtractor ? keyExtractor(row) : i} className="table-row">
                  {columns.map((col) => (
                    <td key={col.key} className={`table-cell ${col.className || ''}`}>
                      {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 flex-wrap gap-2">
          <p className="text-sm text-gray-500">Showing {(meta.page-1)*meta.limit+1}–{Math.min(meta.page*meta.limit,meta.total)} of {meta.total.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => onPageChange?.(meta.page-1)} disabled={!meta.hasPrev} className="btn-secondary btn-sm disabled:opacity-40">
              <ChevronLeft className="w-4 h-4"/>
            </button>
            <span className="text-sm font-semibold text-gray-700 px-1">{meta.page} / {meta.totalPages}</span>
            <button onClick={() => onPageChange?.(meta.page+1)} disabled={!meta.hasNext} className="btn-secondary btn-sm disabled:opacity-40">
              <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

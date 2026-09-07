import { useMemo, useState } from 'react';

// Ordena filas por la columna en la que se haga clic; un segundo clic sobre
// la misma columna invierte el sentido (mayor a menor / menor a mayor).
// `columns` es [{ key, value(row) }] — value() da el valor numérico o de
// texto por el que ordenar esa columna, sea un campo directo o calculado.
export function useSortableTable(rows, columns, defaultKey) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState('desc');

  function toggleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      const cmp = typeof av === 'string' || typeof bv === 'string'
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : (av ?? 0) - (bv ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, columns, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}

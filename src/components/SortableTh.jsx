export default function SortableTh({ label, columnKey, sortKey, sortDir, onSort }) {
  const active = columnKey === sortKey;
  return (
    <th className="sortable-th" onClick={() => onSort(columnKey)}>
      {label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

import { useEffect, useState } from 'react';
import { Empty, Spinner } from './UI';

export default function DataTable({ columns, rows, loading, pageSize = 8, empty = 'Nothing to show yet', hint, onRowClick }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { if (page > pages) setPage(pages); }, [pages, page]);
  if (loading) return <Spinner />;
  if (!rows.length) return <Empty title={empty} hint={hint} />;
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="dt-container">
      {/* Desktop / Tablet Table View (Spacious, Roomy padding) */}
      <div className="tbl-wrap dt-desktop-tbl">
        <table className="tbl">
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr></thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={r.id || i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'click' : ''}>
                {columns.map((c) => <td key={c.key} data-label={c.header}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Screen-Friendly Cards View (No Compacting!) */}
      <div className="dt-mobile-cards">
        {slice.map((r, i) => {
          const actionCol = columns.find((c) => c.key === 'act' || c.key === 'go');
          const primaryCol = columns[0];
          const statusCol = columns.find((c) => c.key === 'status');
          const otherCols = columns.filter((c) => c.key !== primaryCol?.key && c.key !== statusCol?.key && c.key !== 'act' && c.key !== 'go');

          return (
            <div
              key={r.id || i}
              className={`dt-mob-card ${onRowClick ? 'clickable' : ''}`}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {/* Card Header: Primary Identifier + Status */}
              <div className="dt-mob-card-head">
                <div className="dt-mob-primary">
                  {primaryCol?.render ? primaryCol.render(r) : r[primaryCol?.key]}
                </div>
                {statusCol && (
                  <div className="dt-mob-status">
                    {statusCol.render ? statusCol.render(r) : r[statusCol.key]}
                  </div>
                )}
              </div>

              {/* Card Body: Roomy Rows */}
              <div className="dt-mob-card-body">
                {otherCols.map((c) => (
                  <div key={c.key} className="dt-mob-row">
                    <span className="dt-mob-label">{c.header}</span>
                    <div className="dt-mob-val">
                      {c.render ? c.render(r) : r[c.key]}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons: Spacious Touch Targets */}
              {actionCol && (
                <div className="dt-mob-card-actions" onClick={(e) => e.stopPropagation()}>
                  {actionCol.render ? actionCol.render(r) : r[actionCol.key]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pager: Uncompacted & Accessible */}
      <div className="pager">
        <small>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of {rows.length}</small>
        <div>
          <button className="btn sm ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span style={{ padding: '0 8px', fontWeight: 700 }}>{page} / {pages}</span>
          <button className="btn sm ghost" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

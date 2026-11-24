import { STATUSES, fmtDate } from '../utils/helpers';
import { Icon } from './UI';

export default function Timeline({ history = [], status }) {
  const cur = status === 'Delivered' ? 4 : STATUSES.indexOf(status);
  const hist = Array.isArray(history) ? history : [];
  return (
    <ol className="tl">
      {STATUSES.map((s, i) => {
        const h = hist.find((x) => x.status === s);
        return (
          <li key={s} className={i < cur ? 'done' : i === cur ? 'now' : ''}>
            <span className="dot">{i < cur && <Icon n="check" size={14} />}</span>
            <b>{s}</b><small>{h ? fmtDate(h.at) : 'Pending'}</small>
          </li>
        );
      })}
    </ol>
  );
}

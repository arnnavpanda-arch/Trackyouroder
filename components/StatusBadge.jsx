export default function StatusBadge({ status }) {
  return <span className={`badge ${status.toLowerCase().replace('-', '')}`}><i />{status}</span>;
}

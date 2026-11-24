import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import Modal from './Modal';
import { Spinner } from './UI';

export default function AssignAgentModal({ order, onClose, onDone }) {
  const { toast } = useApp();
  const [agents, setAgents] = useState(null);
  const [sel, setSel] = useState(order.agentId || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.listUsers().then((u) => setAgents(u.filter((x) => x.role === 'agent' && x.active))).catch((e) => toast(e.message, 'error')); }, [toast]);
  const submit = async () => {
    setBusy(true);
    try { await api.assignAgent(order.id, sel); toast(`Agent assigned to ${order.id}`, 'success'); onDone(); onClose(); }
    catch (e) { toast(e.message, 'error'); setBusy(false); }
  };
  return (
    <Modal title={`Assign agent · ${order.id}`} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={!sel || busy} onClick={submit}>{busy ? 'Assigning…' : 'Assign agent'}</button></>}>
      {!agents ? <Spinner /> : agents.length === 0 ? <p>No active agents available.</p> : (
        <div className="pick">{agents.map((a) => (
          <label key={a.id} className={sel === a.id ? 'on' : ''}>
            <input type="radio" name="agent" checked={sel === a.id} onChange={() => setSel(a.id)} />
            <span className="avatar">{a.name[0]}</span><div><b>{a.name}</b><small>{a.phone}</small></div>
          </label>
        ))}</div>
      )}
    </Modal>
  );
}

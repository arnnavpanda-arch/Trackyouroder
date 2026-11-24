import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

// Fetches data and silently refetches whenever a relevant socket event arrives.
export default function useLiveData(fetcher, deps = []) {
  const { socket } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => fetcher().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message || 'Something went wrong')).finally(() => setLoading(false)), deps);
  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    if (!socket) return;
    const ev = [
      'orderStatusUpdated',
      'orderAssigned',
      'userCreated',
      'userUpdated',
    ];

    const onOrderDeleted = (payload) => {
      const delId = payload?.orderId || payload?.id;
      if (delId) {
        setData((prev) => (Array.isArray(prev) ? prev.filter((x) => (x?.id || x?._id) !== delId) : prev));
      }
      load();
    };

    const onAllOrdersDeleted = () => {
      setData((prev) => (Array.isArray(prev) ? [] : prev));
      load();
    };

    const onUserDeleted = (payload) => {
      const delId = payload?.userId || payload?.id;
      if (delId) {
        setData((prev) => (Array.isArray(prev) ? prev.filter((x) => (x?.id || x?._id) !== delId) : prev));
      }
      load();
    };

    socket.on('orderDeleted', onOrderDeleted);
    socket.on('allOrdersDeleted', onAllOrdersDeleted);
    socket.on('userDeleted', onUserDeleted);
    ev.forEach((e) => socket.on(e, load));

    return () => {
      socket.off('orderDeleted', onOrderDeleted);
      socket.off('allOrdersDeleted', onAllOrdersDeleted);
      socket.off('userDeleted', onUserDeleted);
      ev.forEach((e) => socket.off(e, load));
    };
  }, [socket, load]);
  return { data, loading, error, reload: load };
}

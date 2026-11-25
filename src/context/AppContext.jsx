import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { closeSocket, getSocket } from '../services/socket';
import { TK, DEFAULT_SETTINGS } from '../utils/helpers';

const defaultContextValue = {
  user: null,
  booting: false,
  settings: DEFAULT_SETTINGS,
  toasts: [],
  notes: [],
  toast: () => {},
  dismiss: () => {},
  markRead: () => {},
  loadSettings: () => {},
  setSettings: () => {},
  login: async () => {},
  register: async () => {},
  logout: () => {},
};

const Ctx = createContext(defaultContextValue);
export const useApp = () => useContext(Ctx) || defaultContextValue;

const getToken = () => {
  try {
    return localStorage.getItem(TK) || sessionStorage.getItem(TK);
  } catch {
    return null;
  }
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());
  const [toasts, setToasts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [settings, setSettings] = useState(() => {
    try {
      const savedLogo = localStorage.getItem('trackora_custom_logo');
      return { ...DEFAULT_SETTINGS, logo_url: savedLogo || '' };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const loadSettings = useCallback(() => {
    api.getSettings()
      .then((s) => {
        if (s) {
          setSettings((prev) => ({ ...prev, ...s }));
          try {
            if (s.logo_url) localStorage.setItem('trackora_custom_logo', s.logo_url);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSettings();

    // Auto-sync custom branding & logo from MongoDB across mobile and other devices
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        loadSettings();
      }
    };
    window.addEventListener('visibilitychange', onFocusOrVisible);
    window.addEventListener('focus', onFocusOrVisible);

    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        loadSettings();
      }
    }, 45000);
    return () => {
      window.removeEventListener('visibilitychange', onFocusOrVisible);
      window.removeEventListener('focus', onFocusOrVisible);
      clearInterval(timer);
    };
  }, [loadSettings]);

  const toast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.me()
      .then(setUser)
      .catch(() => {
        try {
          localStorage.removeItem(TK);
          sessionStorage.removeItem(TK);
        } catch {}
      })
      .finally(() => setBooting(false));
  }, []);

  const socket = useMemo(() => (user ? getSocket(getToken()) : null), [user]);

  useEffect(() => {
    if (!socket || !user) return;
    const onNote = (n) => {
      if (n.to && n.to !== user.id && n.to !== user.role) return;
      setNotes((p) => [{ ...n, read: false }, ...p].slice(0, 30));
      toast(n.message, 'info');
    };
    const onSettings = (updated) => {
      if (updated) {
        setSettings((prev) => ({ ...prev, ...updated }));
        try {
          if (updated.logo_url) localStorage.setItem('trackora_custom_logo', updated.logo_url);
          else if (updated.logo_url === '') localStorage.removeItem('trackora_custom_logo');
        } catch {}
      } else {
        loadSettings();
      }
    };
    const onAgentApproval = (payload) => {
      if (payload && (payload.userId === user.id || payload.userId === user._id)) {
        setUser((prev) => ({
          ...prev,
          isApproved: payload.isApproved,
          approvalStatus: payload.approvalStatus,
          approvalRemarks: payload.remarks || '',
        }));
        if (payload.isApproved) {
          toast('🎉 Congratulations! Your delivery agent account has been approved by admin.', 'success');
        } else {
          toast('⚠️ Notice: Your agent account application was not approved.', 'warning');
        }
      }
    };
    socket.on('newNotification', onNote);
    socket.on('settingsUpdated', onSettings);
    socket.on('agentApprovalChanged', onAgentApproval);
    return () => {
      socket.off('newNotification', onNote);
      socket.off('settingsUpdated', onSettings);
      socket.off('agentApprovalChanged', onAgentApproval);
    };
  }, [socket, user, toast, loadSettings]);

  const authed = ({ token, user: u }) => {
    try {
      localStorage.setItem(TK, token);
      sessionStorage.setItem(TK, token);
    } catch {}
    setUser(u);
    return u;
  };
  const login = async (email, password) => authed(await api.login(email, password));
  const register = async (body) => authed(await api.register(body));
  const logout = () => {
    try {
      localStorage.removeItem(TK);
      sessionStorage.removeItem(TK);
    } catch {}
    closeSocket();
    setUser(null);
    setNotes([]);
  };
  const markRead = () => setNotes((p) => p.map((n) => ({ ...n, read: true })));

  return (
    <Ctx.Provider value={{ user, booting, login, register, logout, socket, toast, toasts, dismiss, notes, markRead, settings, setSettings, loadSettings }}>
      {children}
    </Ctx.Provider>
  );
}

import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Toasts from './components/Toast';
import { Spinner } from './components/UI';
import { homeFor } from './utils/helpers';
import { Login, Register } from './pages/auth/Auth';
import { History, MyOrders, PlaceOrder, UserDashboard } from './pages/user/UserPages';
import { AgentDeliveries } from './pages/agent/AgentPages';
import { AdminDashboard, LiveMonitor, ManageOrders, ManageUsers, Reports } from './pages/admin/AdminPages';
import AdminOffersPage from './pages/admin/AdminOffersPage';
import SystemSettings from './pages/admin/SystemSettings';
import OrderDetails from './pages/OrderDetails';
import FreightHero from './components/FreightHero';
import BrandSplash from './components/BrandSplash';
import CustomerPhonePeScanPage from './pages/CustomerPhonePeScanPage';
import PublicTrackingPage from './pages/PublicTrackingPage';

function UserOrderRedirect() {
  const { id } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    if (id) {
      sessionStorage.setItem('dt_user_active_order', id);
      nav('/user/orders', { replace: true, state: { orderId: id } });
    }
  }, [id, nav]);
  return <Spinner full />;
}

function Guard({ role, children }) {
  const { user, booting } = useApp();
  if (booting) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
function Root() {
  const { user, booting } = useApp();
  if (booting) return <Spinner full />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Toasts />
        <Routes>
          <Route path="/" element={<BrandSplash />} />
          <Route path="/hero" element={<FreightHero />} />
          <Route path="/pay/demo" element={<CustomerPhonePeScanPage />} />
          <Route path="/track/:id" element={<PublicTrackingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/user" element={<Guard role="user"><Layout /></Guard>}>
            <Route index element={<UserDashboard />} />
            <Route path="new" element={<PlaceOrder />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<OrderDetails />} />
            <Route path="history" element={<History />} />
          </Route>
          <Route path="/agent" element={<Guard role="agent"><Layout /></Guard>}>
            <Route index element={<AgentDeliveries />} />
            <Route path="orders" element={<AgentDeliveries />} />
            <Route path="orders/:id" element={<OrderDetails />} />
          </Route>
          <Route path="/admin" element={<Guard role="admin"><Layout /></Guard>}>
            <Route index element={<AdminDashboard />} />
            <Route path="offers" element={<AdminOffersPage />} />
            <Route path="regions" element={<SystemSettings />} />
            <Route path="orders" element={<ManageOrders />} />
            <Route path="orders/:id" element={<OrderDetails />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="live" element={<LiveMonitor />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<SystemSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}

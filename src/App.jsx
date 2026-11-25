import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Toasts from './components/Toast';
import { Spinner } from './components/UI';
import { homeFor } from './utils/helpers';
import BrandSplash from './components/BrandSplash';

// Route-level lazy loading for performance optimization
const Login = lazy(() => import('./pages/auth/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Auth').then((m) => ({ default: m.Register })));
const UserDashboard = lazy(() => import('./pages/user/UserPages').then((m) => ({ default: m.UserDashboard })));
const PlaceOrder = lazy(() => import('./pages/user/UserPages').then((m) => ({ default: m.PlaceOrder })));
const MyOrders = lazy(() => import('./pages/user/UserPages').then((m) => ({ default: m.MyOrders })));
const History = lazy(() => import('./pages/user/UserPages').then((m) => ({ default: m.History })));
const AgentDeliveries = lazy(() => import('./pages/agent/AgentPages').then((m) => ({ default: m.AgentDeliveries })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminDashboard })));
const LiveMonitor = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.LiveMonitor })));
const ManageOrders = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.ManageOrders })));
const ManageUsers = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.ManageUsers })));
const Reports = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.Reports })));
const AdminOffersPage = lazy(() => import('./pages/admin/AdminOffersPage'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const FreightHero = lazy(() => import('./components/FreightHero'));
const CustomerPhonePeScanPage = lazy(() => import('./pages/CustomerPhonePeScanPage'));
const PublicTrackingPage = lazy(() => import('./pages/PublicTrackingPage'));

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
  const allowed = Array.isArray(role) ? role.includes(user.role) : user.role === role;
  if (!allowed) return <Navigate to={homeFor(user.role)} replace />;
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
        <Suspense fallback={<Spinner full />}>
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
              <Route path="district-admins" element={<ManageUsers initialRole="district_admin" />} />
              <Route path="live" element={<LiveMonitor />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<SystemSettings />} />
            </Route>
            <Route path="/district-admin" element={<Guard role="district_admin"><Layout /></Guard>}>
              <Route index element={<Navigate to="/district-admin/orders" replace />} />
              <Route path="orders" element={<ManageOrders districtOnly={true} />} />
              <Route path="orders/:id" element={<OrderDetails />} />
              <Route path="agents" element={<ManageUsers districtOnly={true} />} />
              <Route path="live" element={<LiveMonitor districtOnly={true} />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  );
}

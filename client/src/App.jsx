import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from './components/UI';
import AppLayout from './layouts/AppLayout';
import { AuthPage } from './pages/Auth';
import MonthlySheet from './pages/MonthlySheet';
import NotFound from './pages/NotFound';
import Onboarding from './pages/Onboarding';
import Plan from './pages/Plan';
import Trips from './pages/Trips';
import Savings from './pages/Savings';
import Reports from './pages/Reports';
import Categories from './pages/Categories';
import Settings from './pages/Settings';
import Family from './pages/Family';
import Income from './pages/Income';
import { useAuth } from './store/auth';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const load = useAuth(state => state.load), user = useAuth(state => state.user);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.documentElement.dataset.theme = user?.theme || 'dark'; }, [user]);
  return <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
    <Route element={<Protected><AppLayout /></Protected>}>
      <Route path="/dashboard" element={<MonthlySheet />} />
      <Route path="/plans" element={<Plan />} />
      <Route path="/trips" element={<Trips />} />
      <Route path="/trips/:id" element={<Trips />} />
      <Route path="/savings" element={<Savings />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/income" element={<Income />} />
      <Route path="/family" element={<Family />} />
      <Route path="/settings" element={<Settings />} />
      {['/expenses', '/expenses/new', '/insights'].map(path => <Route key={path} path={path} element={<Navigate to="/dashboard" replace />} />)}
      <Route path="/expenses/:id/edit" element={<Navigate to="/dashboard" replace />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
}

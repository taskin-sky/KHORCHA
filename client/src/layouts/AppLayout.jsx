import { ArrowDownToLine, BarChart3, CalendarRange, CircleDollarSign, LogOut, Map, PiggyBank, Settings, Tags, UsersRound } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../store/auth';

const links = [
  ['/dashboard', 'Monthly Sheet', CalendarRange],
  ['/plans', 'Plan', CircleDollarSign],
  ['/categories', 'Categories', Tags],
  ['/income', 'Income', ArrowDownToLine],
  ['/family', 'Family', UsersRound],
  ['/trips', 'Trips', Map],
  ['/savings', 'Savings', PiggyBank],
  ['/reports', 'Reports', BarChart3],
  ['/settings', 'Settings', Settings],
];

export default function AppLayout() {
  const navigate = useNavigate(), user = useAuth(state => state.user), logout = useAuth(state => state.logout);
  const signOut = async () => { await logout(); navigate('/login'); };
  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <nav>{links.map(([to, label, Icon]) => <NavLink key={to} to={to}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className="profile"><span>{user?.name?.[0]}</span><div><b>{user?.name}</b><small>{user?.email}</small></div><button className="bare profile-logout" onClick={signOut} aria-label="Log out"><LogOut /></button></div>
    </aside>
    <main>
      <div className="mobile-top"><Logo /><button className="icon-btn mobile-logout" onClick={signOut} aria-label="Log out"><LogOut /></button></div>
      <Outlet />
    </main>
    <nav className="bottom-nav simple-nav family-nav">
      <NavLink to="/dashboard"><CalendarRange /><span>Sheet</span></NavLink>
      <NavLink to="/plans"><CircleDollarSign /><span>Plan</span></NavLink>
      <NavLink to="/categories"><Tags /><span>Categories</span></NavLink>
      <NavLink to="/income"><ArrowDownToLine /><span>Income</span></NavLink>
      <NavLink to="/family"><UsersRound /><span>Family</span></NavLink>
      <NavLink to="/trips"><Map /><span>Trips</span></NavLink>
      <NavLink to="/settings"><Settings /><span>Settings</span></NavLink>
    </nav>
  </div>;
}

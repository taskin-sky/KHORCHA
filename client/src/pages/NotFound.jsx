import { Link } from 'react-router-dom'; import Logo from '../components/Logo';
export default function NotFound(){return <div className="not-found"><Logo/><strong>404</strong><h1>This page went off-budget.</h1><p>We couldn’t find what you were looking for.</p><Link className="btn primary" to="/dashboard">Back to dashboard</Link></div>}

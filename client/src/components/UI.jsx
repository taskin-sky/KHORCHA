import { motion as Motion } from 'framer-motion'; import { AlertCircle, LoaderCircle } from 'lucide-react';
export const Card = ({ children, className = '', ...props }) => <Motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`card ${className}`} {...props}>{children}</Motion.section>;
export const Spinner = () => <div className="state"><LoaderCircle className="spin"/><p>Loading your money picture…</p></div>;
export const ErrorState = ({ message = 'Something went wrong', retry }) => <div className="state danger"><AlertCircle/><p>{message}</p>{retry && <button className="btn secondary" onClick={retry}>Try again</button>}</div>;
export const Empty = ({ title, text }) => <div className="state"><span className="empty-icon">৳</span><h3>{title}</h3><p>{text}</p></div>;
export const Progress = ({ value = 0, tone = '' }) => <div className="progress" aria-label={`${value}%`}><span className={tone} style={{ width: `${Math.min(100, Math.max(0, value))}%` }}/></div>;
export const PageHead = ({ eyebrow, title, action }) => <header className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</header>;

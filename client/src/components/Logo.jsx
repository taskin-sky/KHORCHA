import { WalletCards } from 'lucide-react';
export default function Logo({ compact = false }) { return <div className="logo"><span className="logo-mark"><WalletCards size={20}/><b>K</b></span>{!compact && <span><strong>Khorocha</strong><small>Plan. Track. Save.</small></span>}</div>; }

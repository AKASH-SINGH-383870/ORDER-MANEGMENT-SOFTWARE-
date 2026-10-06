import React, { useState, useEffect } from 'react';
import {
  CreditCard, CheckCircle2, Clock, Search, Filter, Plus, ArrowUpRight,
  RefreshCw, Check, X, Building2, User, Upload, Eye, AlertTriangle, FileText,
  ShieldCheck, AlertCircle, Ban
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Payment } from '../types.js';

export const Payments: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('ALL');
  const [mode, setMode] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Modal 1: Add Payment
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [selectedOrderData, setSelectedOrderData] = useState<any | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    order_id: '',
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_mode: 'Bank Transfer',
    reference_number: '',
    proof_url: '',
    notes: ''
  });
  const [proofPreview, setProofPreview] = useState<string>('');

  // Modal 2: Reject Payment
  const [rejectingPayment, setRejectingPayment] = useState<Payment | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Modal 3: Zoom Proof
  const [zoomProof, setZoomProof] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const isAccountsOrAdmin = ['super_admin', 'admin', 'accounts'].includes(user?.role_slug || '');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status !== 'ALL') params.append('status', status);
      if (mode) params.append('payment_mode', mode);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await fetch(`/api/payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setPayments(json.payments || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenOrders = async () => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/orders?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const pending = (json.orders || []).filter((o: any) => o.pending_amount > 0 && o.order_status !== 'CANCELLED');
        setOpenOrders(pending);
        if (pending.length > 0) {
          const first = pending[0];
          setPaymentForm(prev => ({
            ...prev,
            order_id: first.id.toString(),
            reference_number: `TXN-${Math.floor(100000 + Math.random() * 900000)}`
          }));
          setSelectedOrderData(first);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [status, mode, dateFrom, dateTo]);

  // Handle Order Selection inside Add Payment Modal
  const handleOrderChange = (orderIdStr: string) => {
    const oId = Number(orderIdStr);
    const ord = openOrders.find(o => o.id === oId);
    setSelectedOrderData(ord || null);
    setPaymentForm(prev => ({
      ...prev,
      order_id: orderIdStr,
      amount: ord ? ord.pending_amount.toString() : ''
    }));
  };

  // Handle Proof Image Upload
  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid JPG, PNG or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setProofPreview(res);
      setPaymentForm(prev => ({ ...prev, proof_url: res }));
    };
    reader.readAsDataURL(file);
  };

  // Submit Payment Entry (starts in PENDING VERIFICATION)
  const handleCreatePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.order_id || !paymentForm.amount) return;

    const amt = Number(paymentForm.amount);
    if (selectedOrderData && amt > selectedOrderData.pending_amount) {
      alert(`Payment amount (₹${amt}) cannot exceed pending amount (₹${selectedOrderData.pending_amount})`);
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${paymentForm.order_id}/add-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm)
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setProofPreview('');
        setPaymentForm({
          order_id: '',
          amount: '',
          payment_date: new Date().toISOString().slice(0, 10),
          payment_mode: 'Bank Transfer',
          reference_number: '',
          proof_url: '',
          notes: ''
        });
        fetchPayments();
      } else {
        alert(data.error || 'Payment submission failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Approve / Verify Payment Action (Accounts Team)
  const handleVerify = async (paymentId: number) => {
    if (!confirm('Are you sure you want to approve and verify this payment? The verified received amount will be added to the customer ledger.')) {
      return;
    }
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchPayments();
      } else {
        alert(data.error || 'Verification failed');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Payment Action (Accounts Team)
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPayment || !rejectionReason.trim()) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/payments/${rejectingPayment.id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: rejectionReason.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setRejectingPayment(null);
        setRejectionReason('');
        fetchPayments();
      } else {
        alert(data.error || 'Rejection failed');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Metric totals
  const totalAmount = payments.reduce((acc, p) => acc + p.amount, 0);
  const verifiedAmount = payments.filter(p => p.is_verified === 1).reduce((acc, p) => acc + p.amount, 0);
  const pendingPayments = payments.filter(p => p.is_verified === 0);
  const rejectedPayments = payments.filter(p => p.is_verified === -1);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-600" />
            Payments & Financial Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Submit customer payment proofs against orders, manage Accounts Team verification workflow, and track reconciled ledger balances.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchPayments()}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Any authorized user or Sales Person can submit payment! */}
          <button
            onClick={() => {
              fetchOpenOrders();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Submit Payment Entry</span>
          </button>
        </div>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Gross Submitted Receipts</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">
            ₹{totalAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{payments.length} total transaction entries</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Reconciled & Verified</p>
          <p className="text-2xl font-bold text-emerald-600 font-mono mt-1">
            ₹{verifiedAmount.toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Passed accounts ledger audit</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <p className="text-xs font-semibold text-slate-700">Pending Accounts Audit</p>
          <p className="text-2xl font-bold text-amber-600 font-mono mt-1">
            {pendingPayments.length} Payments
          </p>
          <p className="text-[11px] text-amber-800 mt-1">
            ₹{pendingPayments.reduce((a, b) => a + b.amount, 0).toLocaleString('en-IN')} awaiting review
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Rejected Receipts</p>
          <p className="text-2xl font-bold text-rose-600 font-mono mt-1">
            {rejectedPayments.length} Records
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Declined during verification</p>
        </div>
      </div>

      {/* SECTION: PENDING PAYMENT VERIFICATION (Visible prominently to Accounts Team & Admins) */}
      {isAccountsOrAdmin && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                Pending Payment Verification Queue ({pendingPayments.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review submitted client payments, inspect bank transaction proofs, and approve or reject receipts.
              </p>
            </div>
            {pendingPayments.length > 0 && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full animate-pulse">
                Action Required
              </span>
            )}
          </div>

          {pendingPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">All payment submissions are verified!</p>
              <p className="text-slate-500">No pending transactions currently waiting for accounts audit.</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards for Pending Queue (< md) */}
              <div className="block md:hidden space-y-3">
                {pendingPayments.map(p => (
                  <div key={p.id} className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onNavigate(`orders/${p.order_id}`)}
                        className="font-mono font-bold text-amber-600 hover:text-amber-700 text-sm"
                      >
                        {p.order_number}
                      </button>
                      <span className="font-mono font-bold text-emerald-700 text-base">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Client / Vendor</span>
                        <span className="font-semibold text-slate-900">{p.vendor_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Sales Person</span>
                        <span className="font-medium text-slate-800">{p.sales_person_name || 'Sales Rep'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Payment Mode</span>
                        <span className="font-medium text-slate-800">{p.payment_mode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Payment Date</span>
                        <span className="text-slate-700">{p.payment_date}</span>
                      </div>
                    </div>

                    {/* Proof Image */}
                    {p.proof_url && (
                      <div className="flex items-center gap-2 pt-2 border-t border-amber-100">
                        <img
                          src={p.proof_url}
                          alt="Proof"
                          className="w-12 h-12 object-cover rounded-lg border border-slate-300 cursor-pointer"
                          onClick={() => setZoomProof(p.proof_url || null)}
                        />
                        <span className="text-[11px] text-slate-500">Tap image to preview receipt</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                      <button
                        type="button"
                        onClick={() => setRejectingPayment(p)}
                        disabled={actionLoading}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs flex items-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerify(p.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-50/60 border-b border-amber-200 text-slate-700 font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Vendor / Client</th>
                      <th className="py-2.5 px-3">Sales Person</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Payment Mode</th>
                      <th className="py-2.5 px-3">Ref / Transaction #</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-3 text-center">Payment Proof</th>
                      <th className="py-2.5 px-3">Submitted By</th>
                      <th className="py-2.5 px-3 text-center">Accounts Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingPayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          <button
                            onClick={() => onNavigate(`orders/${p.order_id}`)}
                            className="hover:underline text-blue-600 font-mono"
                          >
                            {p.order_number}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">{p.vendor_name}</td>
                        <td className="py-3 px-3 text-slate-600">{p.sales_person_name || 'Sales Rep'}</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700 text-sm">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px]">
                            {p.payment_mode}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">{p.reference_number || '—'}</td>
                        <td className="py-3 px-3 text-slate-600">{p.payment_date}</td>

                        {/* Payment Proof with Preview */}
                        <td className="py-3 px-3 text-center">
                          {p.proof_url ? (
                            <div className="flex items-center justify-center">
                              <img
                                src={p.proof_url}
                                alt="Payment Proof"
                                className="w-9 h-9 object-cover rounded border border-slate-300 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                                onClick={() => setZoomProof(p.proof_url || null)}
                                title="Click to view full payment proof"
                              />
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No proof attached</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-slate-600">
                          <span className="font-medium text-slate-800">{p.received_by_name}</span>
                          <span className="block text-[10px] text-slate-400">{new Date(p.created_at).toLocaleDateString()}</span>
                        </td>

                        {/* Verification Actions: Approve or Reject */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleVerify(p.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center gap-1 text-[11px]"
                              title="Verify and credit ledger"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRejectingPayment(p)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg transition flex items-center gap-1 text-[11px]"
                              title="Reject receipt"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Receipt #, Order #, Vendor name, Ref #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchPayments(); }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Verification Statuses</option>
              <option value="VERIFIED">Verified Only (Approved)</option>
              <option value="PENDING">Pending Verification Only</option>
              <option value="REJECTED">Rejected Receipts Only</option>
            </select>
          </div>

          <div>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">All Payment Modes</option>
              <option value="Bank Transfer">Bank Transfer / NEFT</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <button
            onClick={fetchPayments}
            className="py-2 px-4 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {/* Main Ledger Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Full Transaction History & Audit Ledger</h3>
          <span className="text-xs text-slate-500">{payments.length} records found</span>
        </div>

        {/* Mobile Ledger Cards (< md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span className="text-xs">Loading payments ledger...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No payment entries match your filter.
            </div>
          ) : (
            payments.map((p) => {
              const isVer = p.is_verified === 1;
              const isRej = p.is_verified === -1;
              const isPend = p.is_verified === 0;

              return (
                <div key={p.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-xs">{p.payment_number}</span>
                      <button
                        onClick={() => onNavigate(`orders/${p.order_id}`)}
                        className="block font-mono text-[11px] text-blue-600 hover:underline mt-0.5"
                      >
                        {p.order_number}
                      </button>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 text-base">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Client / Vendor</span>
                      <span className="font-semibold text-slate-900">{p.vendor_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Billing Entity</span>
                      <span className="text-slate-600">{p.billing_company_name || p.company_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Payment Mode</span>
                      <span className="font-medium text-slate-800">{p.payment_mode}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Payment Date</span>
                      <span className="text-slate-700">{p.payment_date}</span>
                    </div>
                  </div>

                  {/* Status & Proof */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      {isVer && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>VERIFIED</span>
                        </span>
                      )}
                      {isPend && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>PENDING</span>
                        </span>
                      )}
                      {isRej && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          <span>REJECTED</span>
                        </span>
                      )}
                      {p.reference_number && (
                        <span className="font-mono text-[10px] text-slate-500">Ref: {p.reference_number}</span>
                      )}
                    </div>

                    {p.proof_url && (
                      <button
                        type="button"
                        onClick={() => setZoomProof(p.proof_url || null)}
                        className="text-[11px] text-amber-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        <span>View Proof</span>
                      </button>
                    )}
                  </div>

                  {isRej && p.rejection_reason && (
                    <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                      Rejection note: {p.rejection_reason}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Client / Vendor</th>
                <th className="py-3 px-4">Billing Company</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Transaction Ref</th>
                <th className="py-3 px-4 text-center">Proof</th>
                <th className="py-3 px-4">Verification Status</th>
                <th className="py-3 px-4">Submitted By</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading payments ledger...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No payment entries match your filter.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isVer = p.is_verified === 1;
                  const isRej = p.is_verified === -1;
                  const isPend = p.is_verified === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.payment_number}</td>
                      <td className="py-3 px-4 font-mono font-semibold">
                        <button
                          onClick={() => onNavigate(`orders/${p.order_id}`)}
                          className="text-blue-600 hover:underline"
                        >
                          {p.order_number}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{p.vendor_name}</td>
                      <td className="py-3 px-4 text-slate-600">{p.billing_company_name || p.company_name || '—'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-right text-emerald-700 text-sm">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px]">
                          {p.payment_mode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{p.reference_number || '—'}</td>

                      {/* Proof Thumbnail */}
                      <td className="py-3 px-4 text-center">
                        {p.proof_url ? (
                          <img
                            src={p.proof_url}
                            alt="Receipt"
                            className="w-7 h-7 object-cover rounded border border-slate-300 mx-auto cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                            onClick={() => setZoomProof(p.proof_url || null)}
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isVer && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-max">
                            <Check className="w-3 h-3" />
                            <span>VERIFIED</span>
                          </span>
                        )}
                        {isPend && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-max">
                            <Clock className="w-3 h-3" />
                            <span>PENDING VERIFICATION</span>
                          </span>
                        )}
                        {isRej && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-max" title={p.rejection_reason}>
                            <Ban className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <p className="font-medium text-slate-800">{p.received_by_name}</p>
                        <p className="text-[10px] text-slate-400">{p.payment_date}</p>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {isVer ? (
                          <div>
                            <span className="text-slate-700 font-semibold">{p.verified_by_name}</span>
                            <span className="block text-[10px] text-slate-400">
                              {p.verified_at ? new Date(p.verified_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                        ) : isRej ? (
                          <span className="text-rose-600 text-[11px] font-semibold truncate max-w-[140px] block" title={p.rejection_reason}>
                            Reason: {p.rejection_reason}
                          </span>
                        ) : isAccountsOrAdmin ? (
                          <button
                            onClick={() => handleVerify(p.id)}
                            className="px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50 font-bold rounded border border-emerald-200"
                          >
                            Approve Now
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Awaiting Audit</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD PAYMENT ENTRY (Form for Sales Reps / Accounts) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  Submit Customer Payment Entry
                </h3>
                <p className="text-xs text-slate-500">
                  Record client payment receipts against confirmed orders. Accounts Team will verify payment before ledger reconciliation.
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleCreatePaymentSubmit} className="space-y-4 text-xs">
              {/* Order Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Order ID *</label>
                <select
                  required
                  value={paymentForm.order_id}
                  onChange={(e) => handleOrderChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                >
                  <option value="">-- Choose Order with Pending Balance --</option>
                  {openOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.vendor_name} (Pending: ₹{o.pending_amount.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-filled Order Metadata Card */}
              {selectedOrderData && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Vendor / Client:</span>
                    <p className="font-bold text-slate-800">{selectedOrderData.vendor_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Billing Company:</span>
                    <p className="font-bold text-slate-800">{selectedOrderData.billing_company_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Order Amount:</span>
                    <p className="font-mono font-bold text-slate-900">₹{selectedOrderData.grand_total.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Current Verified Received:</span>
                    <p className="font-mono font-bold text-emerald-600">₹{(selectedOrderData.amount_received ?? 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex justify-between">
                    <span className="font-bold text-slate-700">Current Pending Amount:</span>
                    <span className="font-mono font-bold text-sm text-rose-600">₹{selectedOrderData.pending_amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              {/* Payment Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedOrderData?.pending_amount}
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-emerald-700 text-sm"
                    placeholder="e.g. 25000"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Payment Mode & Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode *</label>
                  <select
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Ref / UTR / Cheque # *</label>
                  <input
                    type="text"
                    required
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                    placeholder="e.g. UTR-99823102"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                  />
                </div>
              </div>

              {/* Payment Proof Upload */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700">Payment Proof (Screenshot / Deposit Slip)</label>
                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer flex items-center gap-1.5 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose Image</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleProofUpload}
                      className="hidden"
                    />
                  </label>
                  {proofPreview && (
                    <div className="flex items-center gap-2">
                      <img src={proofPreview} alt="Proof preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => { setProofPreview(''); setPaymentForm({ ...paymentForm, proof_url: '' }); }}
                        className="text-[11px] text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="e.g. 50% advance for dispatch clearance"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Submitted By */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                <span>Submitted By: <strong>{user?.name} ({user?.role_name})</strong></span>
                <span className="font-bold text-[10px] bg-amber-200 px-2 py-0.5 rounded uppercase">Pending Verification</span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Submit Payment for Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT PAYMENT WITH REASON (Accounts Team) */}
      {rejectingPayment && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                Reject Payment Receipt #{rejectingPayment.payment_number}
              </h3>
              <button onClick={() => setRejectingPayment(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <p className="text-xs text-slate-600">
              Please enter the specific reason why this payment of <strong>₹{rejectingPayment.amount.toLocaleString('en-IN')}</strong> is being rejected. The submitting user will be notified.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. UTR number mismatch on bank statement; funds not credited to HDFC bank account."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setRejectingPayment(null)}
                  className="px-4 py-2 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ZOOM PAYMENT PROOF */}
      {zoomProof && (
        <div
          onClick={() => setZoomProof(null)}
          className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomProof(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomProof}
              alt="Payment Proof Fullscreen"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

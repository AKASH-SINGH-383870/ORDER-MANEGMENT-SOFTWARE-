import React, { useState, useEffect } from 'react';
import { Users, Phone, Mail, Award, TrendingUp, ShoppingCart, CheckCircle2, AlertCircle, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const SalesPersons: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const [salesTeam, setSalesTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile modal
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [period, setPeriod] = useState<string>('all');
  const [profileLoading, setProfileLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const fetchSalesPersons = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/sales-persons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSalesTeam(json.salesPersons || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (personId: number, targetPeriod: string) => {
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/sales-persons/${personId}?period=${targetPeriod}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setProfileData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesPersons();
  }, []);

  const handleOpenDetail = (person: any) => {
    setSelectedPerson(person);
    setPeriod('all');
    loadProfile(person.id, 'all');
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    if (selectedPerson) {
      loadProfile(selectedPerson.id, newPeriod);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-amber-500" />
          Sales Representatives & Territory Performance
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Measure monthly territory sales targets, booking volume, collection clearance, and client portfolio sizes.
        </p>
      </div>

      {/* Sales Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading sales representatives...</div>
        ) : (
          salesTeam.map(person => (
            <div
              key={person.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-400 transition group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-bold text-base flex items-center justify-center shadow-md">
                      {person.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{person.name}</h3>
                      <span className="font-mono text-[11px] text-slate-400 font-semibold">{person.employee_id}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="mt-4 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{person.mobile}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{person.email}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-[10px] text-slate-400">Total Billed Sales</p>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">₹{(person.total_sales || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-[10px] text-slate-400">Total Received</p>
                    <p className="font-mono font-bold text-emerald-600 text-sm mt-0.5">₹{(person.total_received || 0).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Assigned Vendors: <strong>{person.vendor_count || 0}</strong></span>
                  <span>Orders Booked: <strong>{person.total_orders || 0}</strong></span>
                </div>
              </div>

              <button
                onClick={() => handleOpenDetail(person)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <span>View Performance Drilldown</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* PERFORMANCE DETAIL MODAL */}
      {selectedPerson && profileData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{profileData.person.name}</h2>
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {profileData.person.employee_id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Territory Sales Lead • {profileData.person.mobile} • {profileData.person.email}
                </p>
              </div>

              {/* Time Period Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={period}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="all">All Time</option>
                  <option value="this_month">This Month</option>
                  <option value="this_week">This Week</option>
                  <option value="today">Today Only</option>
                </select>
                <button onClick={() => setSelectedPerson(null)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
            </div>

            {/* Performance KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border">
                <p className="text-slate-400">Total Orders</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{profileData.metrics.total_orders || 0}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border">
                <p className="text-slate-400">Total Billed Sales</p>
                <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  ₹{(profileData.metrics.total_order_value || 0).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-emerald-700">Collected Amount</p>
                <p className="text-xl font-bold text-emerald-800 font-mono mt-0.5">
                  ₹{(profileData.metrics.amount_received || 0).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-rose-700">Pending Collections</p>
                <p className="text-xl font-bold text-rose-800 font-mono mt-0.5">
                  ₹{(profileData.metrics.pending_amount || 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Complete Order List */}
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">Booked Orders ({profileData.orders.length})</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Products</th>
                      <th className="py-2.5 px-3">Vendor</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Value (₹)</th>
                      <th className="py-2.5 px-3 text-right">Received (₹)</th>
                      <th className="py-2.5 px-3 text-right">Pending (₹)</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profileData.orders.map((ord: any) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-600 cursor-pointer" onClick={() => {
                          setSelectedPerson(null);
                          onNavigate(`orders/${ord.id}`);
                        }}>
                          {ord.order_number}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {(ord.items || []).slice(0, 2).map((item: any, iIdx: number) => (
                              <div
                                key={iIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.product_image) setZoomImage(item.product_image);
                                }}
                                className="w-7 h-7 rounded bg-white border border-slate-200 overflow-hidden cursor-pointer hover:border-amber-400 shadow-2xs shrink-0"
                                title={`${item.product_name} (${item.sku})`}
                              >
                                <img
                                  src={item.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80'}
                                  alt={item.product_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                            {(ord.items?.length || 0) > 2 && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                +{(ord.items?.length || 0) - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{ord.vendor_name}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(ord.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">₹{ord.grand_total.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600">₹{ord.amount_received.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">₹{ord.pending_amount.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 font-semibold">{ord.order_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setSelectedPerson(null)} className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
        >
          <div className="relative max-w-lg max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={zoomImage} alt="Lubricant Product Full Preview" className="w-full h-auto object-contain max-h-[75vh] rounded-xl" />
            <div className="p-3 text-center">
              <button
                onClick={() => setZoomImage(null)}
                className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

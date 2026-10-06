import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, Package, MapPin, Eye, RefreshCw, X, ArrowRight, ShieldCheck, User, Search, RotateCcw, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { DispatchStatusBadge, DeliveryStatusBadge } from '../components/StatusBadge.js';
import { DateRangeFilter, DateTypeOption } from '../components/DateRangeFilter.js';
import { DateRange, getDateRangeFromPreset } from '../utils/dateFilters.js';

const DISPATCH_DATE_TYPES: DateTypeOption[] = [
  { value: 'order_date', label: 'Order Date' },
  { value: 'dispatch_date', label: 'Dispatch Date' },
  { value: 'delivery_date', label: 'Delivery Date' },
];

export const DispatchDelivery: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user, hasPermission } = useAuth();
  const canCreateDispatch = user?.role_slug === 'admin' || user?.role_slug === 'super_admin' || user?.role_slug === 'dispatch_team' || hasPermission('dispatch:create');
  const canRecordDelivery = user?.role_slug === 'admin' || user?.role_slug === 'super_admin' || user?.role_slug === 'dispatch_team' || hasPermission('dispatch:update_delivery');

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Filters State
  const [dateType, setDateType] = useState<string>('order_date');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeFromPreset('this_month'));
  const [salesPersonId, setSalesPersonId] = useState<string>('ALL');
  const [vendorId, setVendorId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Modal 1: Create Dispatch
  const [dispatchOrder, setDispatchOrder] = useState<any | null>(null);
  const [orderItemsForDispatch, setOrderItemsForDispatch] = useState<any[]>([]);
  const [dispatchForm, setDispatchForm] = useState({
    transport_name: 'VRL Logistics',
    transport_contact: '+91 22 2844 9900',
    vehicle_number: 'MH-12-RN-4820',
    lr_number: '',
    tracking_number: '',
    driver_name: 'Kailash Yadav',
    driver_mobile: '+91 98220 77881',
    dispatch_date: new Date().toISOString().slice(0, 10),
    notes: 'Secure drums with ratchet straps'
  });
  const [dispatchItemQtys, setDispatchItemQtys] = useState<Record<number, number>>({});

  // Modal 2: Record Delivery
  const [deliveryOrder, setDeliveryOrder] = useState<any | null>(null);
  const [orderItemsForDelivery, setOrderItemsForDelivery] = useState<any[]>([]);
  const [deliveryForm, setDeliveryForm] = useState({
    received_by: '',
    receiver_mobile: '',
    delivery_date: new Date().toISOString().slice(0, 10),
    notes: 'Received in good intact condition. Stamp placed on LR copy.'
  });
  const [deliveryItemQtys, setDeliveryItemQtys] = useState<Record<number, number>>({});

  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async (
    range: DateRange = dateRange,
    dt: string = dateType,
    sp: string = salesPersonId,
    v: string = vendorId,
    search: string = searchTerm
  ) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams();
      if (range.startDate) params.append('startDate', range.startDate);
      if (range.endDate) params.append('endDate', range.endDate);
      params.append('date_type', dt);
      if (sp && sp !== 'ALL') params.append('sales_person_id', sp);
      if (v && v !== 'ALL') params.append('vendor_id', v);
      if (search) params.append('search', search);

      const res = await fetch(`/api/dispatch/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
        if (json.salesPersons) setSalesPersons(json.salesPersons);
        if (json.vendors) setVendors(json.vendors);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(dateRange, dateType, salesPersonId, vendorId, searchTerm);
  }, [dateRange, dateType, salesPersonId, vendorId]);

  const handleResetFilters = () => {
    const defaultRange = getDateRangeFromPreset('this_month');
    setDateRange(defaultRange);
    setDateType('order_date');
    setSalesPersonId('ALL');
    setVendorId('ALL');
    setSearchTerm('');
    fetchOrders(defaultRange, 'order_date', 'ALL', 'ALL', '');
  };

  // Open Dispatch Modal
  const handleOpenDispatchModal = async (order: any) => {
    setDispatchOrder(order);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setOrderItemsForDispatch(json.items || []);
        const initialQtys: Record<number, number> = {};
        for (const it of json.items || []) {
          const avail = it.produced_quantity - it.dispatched_quantity;
          initialQtys[it.id] = Math.max(0, avail);
        }
        setDispatchItemQtys(initialQtys);
        setDispatchForm(prev => ({
          ...prev,
          lr_number: `LR-${Math.floor(100000 + Math.random() * 900000)}`
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Dispatch
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchOrder) return;
    setActionLoading(true);

    const itemsPayload = Object.entries(dispatchItemQtys).map(([itemId, qty]) => ({
      item_id: Number(itemId),
      quantity: Number(qty)
    })).filter(x => x.quantity > 0);

    if (itemsPayload.length === 0) {
      alert('Please specify quantity to dispatch for at least one item');
      setActionLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${dispatchOrder.id}/create-dispatch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dispatchForm,
          items: itemsPayload
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDispatchOrder(null);
        fetchOrders();
      } else {
        alert(data.error || 'Dispatch creation failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Open Delivery Modal
  const handleOpenDeliveryModal = async (order: any) => {
    setDeliveryOrder(order);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setOrderItemsForDelivery(json.items || []);
        const initialQtys: Record<number, number> = {};
        for (const it of json.items || []) {
          const avail = it.dispatched_quantity - it.delivered_quantity;
          initialQtys[it.id] = Math.max(0, avail);
        }
        setDeliveryItemQtys(initialQtys);
        setDeliveryForm(prev => ({
          ...prev,
          received_by: order.delivery_contact_person || order.vendor_name,
          receiver_mobile: order.delivery_contact_number || ''
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Delivery
  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryOrder) return;
    setActionLoading(true);

    const itemsPayload = Object.entries(deliveryItemQtys).map(([itemId, qty]) => ({
      item_id: Number(itemId),
      quantity: Number(qty)
    })).filter(x => x.quantity > 0);

    if (itemsPayload.length === 0) {
      alert('Please specify delivered quantity for at least one item');
      setActionLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${deliveryOrder.id}/update-delivery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...deliveryForm,
          items: itemsPayload
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDeliveryOrder(null);
        fetchOrders();
      } else {
        alert(data.error || 'Delivery recording failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const readyOrders = orders.filter(o => o.order_status === 'READY_FOR_DISPATCH');
  const transitOrders = orders.filter(o => o.order_status === 'OUT_FOR_DELIVERY');
  const deliveredOrders = orders.filter(o => o.order_status === 'DELIVERED');

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-xs font-semibold text-slate-500">Loading Dispatch & Fleet Logistics...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-cyan-600" />
            Dispatch & Fleet Delivery Logistics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assign transport carriers, generate LR / Bilty tracking numbers, record multiple dispatches, and log customer proof of delivery (POD).
          </p>
        </div>

        <button
          onClick={() => fetchOrders()}
          className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Fleet</span>
        </button>
      </div>

      {/* Unified Dispatch & Delivery Date Filter */}
      <DateRangeFilter
        value={dateRange}
        onChange={(newRange, newDt) => {
          setDateRange(newRange);
          if (newDt) setDateType(newDt);
        }}
        dateTypes={DISPATCH_DATE_TYPES}
        currentDateType={dateType}
        onDateTypeChange={(dt) => setDateType(dt)}
        defaultPreset="this_month"
        allowAllTime={true}
      />

      {/* Secondary Operational Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search Consignment</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search order #, vendor name, transport..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchOrders(dateRange, dateType, salesPersonId, vendorId, searchTerm);
                  }
                }}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Vendor Filter */}
          <div className="sm:col-span-1 lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-600" />
              <span>Vendor / Client</span>
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:border-cyan-500 outline-none cursor-pointer"
            >
              <option value="ALL">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Sales Person Filter */}
          <div className="sm:col-span-1 lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-600" />
              <span>Sales Officer</span>
            </label>
            {user?.role_slug !== 'sales_person' ? (
              <select
                value={salesPersonId}
                onChange={(e) => setSalesPersonId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="ALL">All Sales Officers</option>
                {salesPersons.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <div className="w-full py-2 px-3 bg-cyan-50/50 border border-cyan-200 text-cyan-900 rounded-lg text-xs font-semibold truncate">
                {user.name}
              </div>
            )}
          </div>

          {/* Clear Filters */}
          <div className="lg:col-span-1 flex items-center justify-end">
            {(salesPersonId !== 'ALL' || vendorId !== 'ALL' || searchTerm || dateType !== 'order_date' || dateRange.preset !== 'this_month') && (
              <button
                onClick={handleResetFilters}
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shrink-0 transition"
                title="Reset filters"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: READY FOR DISPATCH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              Ready for Dispatch Queue ({readyOrders.length})
            </h2>
            <p className="text-xs text-slate-500">Batch production completed by plant. Waiting for carrier & vehicle loading.</p>
          </div>
        </div>

        {readyOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
            No orders currently pending vehicle loading.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyOrders.map(ord => (
              <div key={ord.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-full">
                      Ready to Load
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mt-1">{ord.vendor_name}</h4>
                  <p className="text-xs text-slate-500">{ord.vendor_city} • Target: {ord.required_delivery_date || 'Standard'}</p>
                  <p className="text-xs text-slate-700 mt-2 font-mono">
                    Total Volume: <strong>{ord.total_qty} units</strong>
                  </p>
                </div>

                {/* Product Images & Items Preview */}
                {ord.items && ord.items.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto py-1">
                    {ord.items.slice(0, 3).map((it: any) => (
                      <div key={it.id} className="flex items-center gap-1.5 bg-white p-1 rounded-md border border-slate-200 shrink-0 max-w-[170px]">
                        <img
                          src={it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'}
                          alt={it.product_name}
                          className="w-7 h-7 object-cover rounded bg-slate-100 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomImage(it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80');
                          }}
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'; }}
                        />
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-semibold text-slate-800 truncate" title={it.product_name}>
                            {it.product_name} {it.unit ? `– ${it.unit}` : ''}
                          </p>
                          <p className="text-[9px] text-slate-500 font-mono">{it.quantity} {it.unit}</p>
                        </div>
                      </div>
                    ))}
                    {ord.items.length > 3 && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        +{ord.items.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    onClick={() => onNavigate(`orders/${ord.id}`)}
                    className="p-1.5 text-slate-500 hover:text-slate-800"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canCreateDispatch ? (
                    <button
                      onClick={() => handleOpenDispatchModal(ord)}
                      className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Create Dispatch</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigate(`orders/${ord.id}`)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
                    >
                      View Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: OUT FOR DELIVERY (IN TRANSIT) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
              Out for Delivery / In Transit ({transitOrders.length})
            </h2>
            <p className="text-xs text-slate-500">Consignments on the road. Awaiting destination receiving confirmation.</p>
          </div>
        </div>

        {transitOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
            No orders currently in transit.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {transitOrders.map(ord => (
              <div key={ord.id} className="p-4 rounded-xl border border-slate-200 bg-cyan-50/20 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                    <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] font-bold rounded-full">
                      On Route
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mt-1">{ord.vendor_name}</h4>
                  <p className="text-xs text-slate-500 truncate" title={ord.delivery_address}>
                    Destination: {ord.delivery_address}
                  </p>
                  <p className="text-xs text-slate-700 mt-1 font-mono">
                    Dispatched: <strong>{ord.total_dispatched ?? 0} / {ord.total_qty ?? 0} units</strong>
                  </p>
                </div>

                {/* Product Images & Items Preview */}
                {ord.items && ord.items.length > 0 && (
                  <div className="pt-2 border-t border-cyan-100 flex items-center gap-1.5 overflow-x-auto py-1">
                    {ord.items.slice(0, 3).map((it: any) => (
                      <div key={it.id} className="flex items-center gap-1.5 bg-white p-1 rounded-md border border-cyan-200/60 shrink-0 max-w-[170px]">
                        <img
                          src={it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'}
                          alt={it.product_name}
                          className="w-7 h-7 object-cover rounded bg-slate-100 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomImage(it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80');
                          }}
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'; }}
                        />
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-semibold text-slate-800 truncate" title={it.product_name}>
                            {it.product_name} {it.unit ? `– ${it.unit}` : ''}
                          </p>
                          <p className="text-[9px] text-cyan-700 font-mono font-bold">{it.dispatched_quantity ?? it.quantity} {it.unit}</p>
                        </div>
                      </div>
                    ))}
                    {ord.items.length > 3 && (
                      <span className="text-[10px] font-bold text-slate-500 bg-cyan-100 px-1.5 py-0.5 rounded shrink-0">
                        +{ord.items.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    onClick={() => onNavigate(`orders/${ord.id}`)}
                    className="p-1.5 text-slate-500 hover:text-slate-800"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canRecordDelivery ? (
                    <button
                      onClick={() => handleOpenDeliveryModal(ord)}
                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Record Delivery</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigate(`orders/${ord.id}`)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
                    >
                      View Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: RECENTLY DELIVERED (Reminding user of Delivery ≠ Completed) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
              Delivered Consignments ({deliveredOrders.length})
            </h2>
            <p className="text-xs text-slate-500">
              Customer acknowledged receipt. Note: Orders remain open until Accounts verifies final payments.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Order ID</th>
                <th className="py-2.5 px-3">Vendor</th>
                <th className="py-2.5 px-3">Products</th>
                <th className="py-2.5 px-3">Delivered Qty</th>
                <th className="py-2.5 px-3">Delivery Status</th>
                <th className="py-2.5 px-3">Payment State</th>
                <th className="py-2.5 px-3 text-right">Pending Balance</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveredOrders.slice(0, 8).map(ord => (
                <tr key={ord.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{ord.order_number}</td>
                  <td className="py-3 px-3 font-medium text-slate-900">{ord.vendor_name}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      {ord.items && ord.items.length > 0 ? (
                        <>
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {ord.items.slice(0, 3).map((it: any) => (
                              <img
                                key={it.id}
                                src={it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'}
                                alt={it.product_name}
                                title={it.product_name}
                                className="w-6 h-6 rounded object-cover border border-white bg-slate-100 shrink-0 cursor-pointer"
                                onClick={() => setZoomImage(it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80')}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'; }}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] text-slate-700 font-medium truncate max-w-[130px]" title={ord.items.map((x: any) => `${x.product_name} – ${x.unit}`).join(', ')}>
                            {ord.items[0]?.product_name} {ord.items[0]?.unit ? `– ${ord.items[0]?.unit}` : ''}
                            {ord.items.length > 1 && ` (+${ord.items.length - 1})`}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">Products</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-teal-700">{ord.total_delivered ?? 0} units</td>
                  <td className="py-3 px-3"><DeliveryStatusBadge status="DELIVERED" /></td>
                  <td className="py-3 px-3 font-semibold text-slate-700">{ord.payment_status || 'PENDING'}</td>
                  <td className="py-3 px-3 font-mono font-bold text-right text-rose-600">
                    ₹{(ord.pending_amount ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onNavigate(`orders/${ord.id}`)}
                      className="px-2.5 py-1 text-xs text-amber-600 hover:text-amber-700 font-semibold"
                    >
                      View Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE DISPATCH */}
      {dispatchOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Create Transport Dispatch</h3>
                <p className="text-xs text-slate-500">Order #{dispatchOrder.order_number} • {dispatchOrder.vendor_name}</p>
              </div>
              <button onClick={() => setDispatchOrder(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Transporter / Logistics Partner *</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.transport_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, transport_name: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                    placeholder="e.g. VRL Logistics, TCI Freight, Safexpress"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Vehicle / Truck Registration Number *</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.vehicle_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase font-bold"
                    placeholder="e.g. MH-12-RN-4820"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">LR / Bilty / Docket Number</label>
                  <input
                    type="text"
                    value={dispatchForm.lr_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, lr_number: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    placeholder="e.g. LR-992381"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Driver Name & Mobile</label>
                  <input
                    type="text"
                    value={dispatchForm.driver_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="Driver Name"
                  />
                </div>
              </div>

              {/* Items dispatch quantity inputs */}
              <div className="pt-2">
                <p className="font-semibold text-slate-700 mb-1">Specify Dispatch Quantities (Partial Dispatches Allowed)</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orderItemsForDispatch.map(it => {
                    const available = it.produced_quantity - it.dispatched_quantity;
                    return (
                      <div key={it.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'}
                            alt={it.product_name}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-white shrink-0 cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setZoomImage(it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80')}
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'; }}
                          />
                          <div>
                            <p className="font-semibold text-slate-800 text-xs">{it.product_name} {it.unit ? `– ${it.unit}` : ''}</p>
                            <span className="text-[11px] text-slate-500 font-mono">SKU: {it.sku} • Ordered: {it.quantity} | Available: {available} {it.unit}</span>
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={available}
                          value={dispatchItemQtys[it.id] ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDispatchItemQtys(prev => ({ ...prev, [it.id]: val }));
                          }}
                          className="w-20 p-1.5 text-right font-bold bg-white border border-slate-300 rounded shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Dispatch Remarks</label>
                <input
                  type="text"
                  value={dispatchForm.notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setDispatchOrder(null)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg">
                  Submit Dispatch & Move Out for Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD DELIVERY */}
      {deliveryOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Record Consignment Delivery</h3>
                <p className="text-xs text-slate-500">Order #{deliveryOrder.order_number} • {deliveryOrder.vendor_name}</p>
              </div>
              <button onClick={() => setDeliveryOrder(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleDeliverySubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Received By (Receiver Name) *</label>
                  <input
                    type="text"
                    required
                    value={deliveryForm.received_by}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, received_by: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                    placeholder="e.g. Ramesh Agrawal (Store Manager)"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Receiver Mobile *</label>
                  <input
                    type="text"
                    required
                    value={deliveryForm.receiver_mobile}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, receiver_mobile: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="+91 98220 12345"
                  />
                </div>
              </div>

              {/* Items delivered quantity inputs */}
              <div className="pt-2">
                <p className="font-semibold text-slate-700 mb-1">Specify Quantities Received (Partial Deliveries Allowed)</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orderItemsForDelivery.map(it => {
                    const remaining = it.dispatched_quantity - it.delivered_quantity;
                    return (
                      <div key={it.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'}
                            alt={it.product_name}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-white shrink-0 cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setZoomImage(it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80')}
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'; }}
                          />
                          <div>
                            <p className="font-semibold text-slate-800 text-xs">{it.product_name} {it.unit ? `– ${it.unit}` : ''}</p>
                            <span className="text-[11px] text-slate-500 font-mono">SKU: {it.sku} • Dispatched: {it.dispatched_quantity} | Pending: {remaining} {it.unit}</span>
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={deliveryItemQtys[it.id] ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDeliveryItemQtys(prev => ({ ...prev, [it.id]: val }));
                          }}
                          className="w-20 p-1.5 text-right font-bold bg-white border border-slate-300 rounded shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Proof of Delivery (POD) / Receipt Remarks</label>
                <textarea
                  rows={2}
                  value={deliveryForm.notes}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setDeliveryOrder(null)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg">
                  Confirm Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE ZOOM PREVIEW MODAL */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomImage}
              alt="Product High Resolution"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
    import { LayoutDashboard, Package, ShoppingCart, Users, Image as ImageIcon, Tag, Settings, Menu, Bell, Search } from 'lucide-react';
    import { useShop } from '../context/ShopContext';

    // This is a UI-only frontend simulation as requested
    export default function Admin() {
      const { products } = useShop();
      const [activeTab, setActiveTab] = useState('dashboard');

      const stats = [
        { label: 'Total Revenue', value: '₹12,45,000', change: '+14%' },
        { label: 'Active Orders', value: '42', change: '+5%' },
        { label: 'Total Products', value: products.length.toString(), change: '0%' },
        { label: 'Total Customers', value: '156', change: '+12%' },
      ];

      return (
        <div className="min-h-screen bg-gray-50 flex font-sans">
          
          {/* Sidebar */}
          <aside className="w-64 bg-baba-primary text-white flex-shrink-0 flex flex-col hidden md:flex">
            <div className="h-20 flex items-center justify-center border-b border-white/10">
              <span className="font-serif text-2xl font-bold tracking-wider text-baba-accent">BABA ADMIN</span>
            </div>
            <nav className="flex-1 py-6 px-4 space-y-2">
              <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavItem icon={<Package />} label="Products" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
              <NavItem icon={<ShoppingCart />} label="Orders" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
              <NavItem icon={<Users />} label="Customers" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
              <NavItem icon={<ImageIcon />} label="Banners" active={activeTab === 'banners'} onClick={() => setActiveTab('banners')} />
              <NavItem icon={<Tag />} label="Promo Codes" active={activeTab === 'promos'} onClick={() => setActiveTab('promos')} />
            </nav>
            <div className="p-4 border-t border-white/10">
              <NavItem icon={<Settings />} label="Settings" active={false} onClick={() => {}} />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col h-screen overflow-hidden">
            {/* Admin Header */}
            <header className="h-20 bg-white shadow-sm flex items-center justify-between px-8 flex-shrink-0 z-10">
              <div className="flex items-center gap-4">
                <button className="md:hidden text-gray-500 hover:text-baba-primary">
                  <Menu className="w-6 h-6" />
                </button>
                <div className="relative hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-md text-sm focus:bg-white focus:border-baba-accent focus:ring-1 focus:ring-baba-accent outline-none w-64 transition-all" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <button className="relative text-gray-500 hover:text-baba-primary">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-baba-accent text-white flex items-center justify-center font-bold text-sm">A</div>
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">Admin User</span>
                </div>
              </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-8">
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800">Dashboard Overview</h2>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                      <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                        <div className="flex items-end justify-between">
                          <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
                          <span className={`text-sm font-medium ${stat.change.startsWith('+') ? 'text-green-500' : 'text-gray-500'}`}>{stat.change}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent Orders Placeholder */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-800">Recent Orders</h3>
                      <button className="text-sm text-baba-accent hover:underline font-medium">View All</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-sm text-gray-500 border-b border-gray-200">
                            <th className="pb-3 font-medium">Order ID</th>
                            <th className="pb-3 font-medium">Customer</th>
                            <th className="pb-3 font-medium">Date</th>
                            <th className="pb-3 font-medium">Amount</th>
                            <th className="pb-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-gray-700">
                          {[1,2,3,4].map((item) => (
                            <tr key={item} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                              <td className="py-4 font-medium text-baba-primary">#ORD-90{item}2</td>
                              <td className="py-4">Wholesale Buyer {item}</td>
                              <td className="py-4">Today, 10:{item}0 AM</td>
                              <td className="py-4 font-medium">₹{(item * 15000).toLocaleString('en-IN')}</td>
                              <td className="py-4"><span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Processing</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'products' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Product Management</h2>
                    <button className="bg-baba-primary text-white px-4 py-2 rounded-md hover:bg-baba-accent transition-colors text-sm font-medium">
                      + Add New Product
                    </button>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-sm text-gray-500">
                        <tr>
                          <th className="px-6 py-4 font-medium">Product</th>
                          <th className="px-6 py-4 font-medium">Code</th>
                          <th className="px-6 py-4 font-medium">Category</th>
                          <th className="px-6 py-4 font-medium">Price</th>
                          <th className="px-6 py-4 font-medium">Total Stock</th>
                          <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {products.map(p => {
                          const totalStock = p.colors.reduce((acc, c) => acc + c.stock, 0);
                          return (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 flex items-center gap-3">
                                <img src={p.colors[0].image} alt="" className="w-10 h-10 rounded object-cover" />
                                <span className="font-medium text-gray-900">{p.name}</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 font-mono">{p.code}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{p.category}</td>
                              <td className="px-6 py-4 text-sm font-medium">₹{p.price.toLocaleString('en-IN')}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${totalStock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {totalStock}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-sm">
                                <button className="text-baba-accent hover:text-baba-primary font-medium mr-3">Edit</button>
                                <button className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Placeholder for other tabs */}
              {['orders', 'customers', 'banners', 'promos'].includes(activeTab) && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Settings className="w-16 h-16 mb-4 opacity-20" />
                  <h2 className="text-xl font-medium text-gray-600 mb-2 capitalize">{activeTab} Management</h2>
                  <p>UI Component Placeholder</p>
                </div>
              )}
            </div>
          </main>
        </div>
      );
    }

    const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
      <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium ${active ? 'bg-baba-accent text-baba-primary' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
      >
        <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
        {label}
      </button>
    );